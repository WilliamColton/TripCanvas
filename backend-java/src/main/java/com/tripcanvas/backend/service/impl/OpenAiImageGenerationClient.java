package com.tripcanvas.backend.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripcanvas.backend.config.ExecutorConfig;
import com.tripcanvas.backend.dto.generation.GeneratedImage;
import com.tripcanvas.backend.dto.generation.ImageFileInput;
import com.tripcanvas.backend.dto.generation.ImageGenerationResult;
import com.tripcanvas.backend.dto.response.ApiEndpointResponse;
import com.tripcanvas.backend.dto.response.TaskParamsResponse;
import com.tripcanvas.backend.service.AppConfigService;
import com.tripcanvas.backend.service.EndpointLimiterService;
import com.tripcanvas.backend.service.ImageGenerationClient;
import com.tripcanvas.backend.util.ImageSizeUtils;
import com.tripcanvas.backend.util.JsonUtils;
import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Service
@Slf4j
public class OpenAiImageGenerationClient implements ImageGenerationClient {
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(30);
    private static final Duration REQUEST_TIMEOUT = Duration.ofMinutes(30);

    private final EndpointLimiterService endpointLimiterService;
    private final AppConfigService appConfigService;
    private final ObjectMapper objectMapper = JsonUtils.mapper();
    private final RestClient restClient;
    private final Executor concurrentExecutor;

    public OpenAiImageGenerationClient(
        EndpointLimiterService endpointLimiterService,
        AppConfigService appConfigService,
        RestClient.Builder restClientBuilder,
        @Qualifier(ExecutorConfig.IMAGE_REQUEST_EXECUTOR) Executor concurrentExecutor
    ) {
        this.endpointLimiterService = endpointLimiterService;
        this.appConfigService = appConfigService;
        this.concurrentExecutor = concurrentExecutor;
        this.restClient = restClientBuilder
            .requestFactory(requestFactory())
            .build();
    }

    @Override
    public ImageGenerationResult generate(String prompt, TaskParamsResponse params, int n, boolean codexCli, Runnable onAcquired, List<ApiEndpointResponse> endpoints) {
        int normalizedN = ImageSizeUtils.normalizeTaskN(n);
        if (codexCli && normalizedN > 1) {
            Runnable acquiredOnce = once(onAcquired);
            TaskParamsResponse singleParams = new TaskParamsResponse(params.size(), params.tier(), "auto", params.outputFormat(), params.outputCompression(), params.moderation(), 1);
            return runConcurrent(normalizedN, () -> generate(prompt, singleParams, 1, true, acquiredOnce, endpoints));
        }
        return withFailover(endpoints, onAcquired, endpoint -> generateOnce(prompt, params, normalizedN, codexCli, endpoint));
    }

    @Override
    public ImageGenerationResult edit(String prompt, TaskParamsResponse params, List<ImageFileInput> imageFiles, ImageFileInput maskFile, int n, boolean codexCli, Runnable onAcquired, List<ApiEndpointResponse> endpoints) {
        int normalizedN = ImageSizeUtils.normalizeTaskN(n);
        if (normalizedN > 1) {
            Runnable acquiredOnce = once(onAcquired);
            return runConcurrent(normalizedN, () -> edit(prompt, params, imageFiles, maskFile, 1, false, acquiredOnce, endpoints));
        }
        return withFailover(endpoints, onAcquired, endpoint -> editOnce(prompt, params, imageFiles, maskFile, codexCli, endpoint));
    }

    private ImageGenerationResult withFailover(List<ApiEndpointResponse> endpoints, Runnable onAcquired, EndpointCall call) {
        if (endpoints == null || endpoints.isEmpty()) {
            throw new IllegalStateException("no endpoints configured");
        }
        Exception lastError = null;
        boolean[] acquired = {false};
        Runnable acquiredOnce = () -> {
            if (!acquired[0]) {
                acquired[0] = true;
                if (onAcquired != null) {
                    onAcquired.run();
                }
            }
        };
        for (int start = 0; start < endpoints.size(); ) {
            try (EndpointLimiterService.Lease lease = endpointLimiterService.acquire(endpoints, start, acquiredOnce)) {
                ApiEndpointResponse endpoint = endpoints.get(lease.endpointIndex());
                try {
                    ImageGenerationResult result = call.execute(endpoint);
                    return withEndpointAttribution(result, endpoint);
                } catch (Exception e) {
                    throw new EndpointFailure(lease.endpointIndex(), e);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("任务已取消", e);
            } catch (Exception e) {
                lastError = e;
                start = nextStart(endpoints, start, e);
                log.warn("failover: 端点失败，尝试下一个", e);
            }
        }
        throw new IllegalStateException(lastError == null ? "所有端点均失败" : "所有端点均失败，最后错误: " + lastError.getMessage(), lastError);
    }

    private int nextStart(List<ApiEndpointResponse> endpoints, int fallbackStart, Exception error) {
        if (error instanceof EndpointFailure endpointFailure) {
            return endpointFailure.endpointIndex + 1;
        }
        return fallbackStart + 1;
    }

    private ImageGenerationResult generateOnce(String prompt, TaskParamsResponse params, int n, boolean codexCli, ApiEndpointResponse endpoint) throws IOException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", appConfigService.model());
        body.put("prompt", codexCli ? codexPrompt(prompt) : prompt);
        body.put("size", params.size());
        body.put("quality", params.quality());
        body.put("output_format", params.outputFormat());
        body.put("moderation", params.moderation());
        if (n > 1) {
            body.put("n", n);
        }
        if (!"png".equals(params.outputFormat()) && params.outputCompression() != null) {
            body.put("output_compression", params.outputCompression());
        }
        JsonNode response = postJson(endpoint, "/images/generations", body);
        return convertImagesResponse(response, params);
    }

    private ImageGenerationResult editOnce(String prompt, TaskParamsResponse params, List<ImageFileInput> imageFiles, ImageFileInput maskFile, boolean codexCli, ApiEndpointResponse endpoint) throws IOException {
        JsonNode response = postMultipart(endpoint, "/images/edits", multipartBody(prompt, params, imageFiles, maskFile, codexCli));
        return convertImagesResponse(response, params);
    }

    private JsonNode postJson(ApiEndpointResponse endpoint, String path, Map<String, Object> body) throws IOException {
        return execute(endpoint, path, MediaType.APPLICATION_JSON, body);
    }

    private JsonNode postMultipart(ApiEndpointResponse endpoint, String path, MultiValueMap<String, HttpEntity<?>> body) throws IOException {
        return execute(endpoint, path, MediaType.MULTIPART_FORM_DATA, body);
    }

    private JsonNode execute(ApiEndpointResponse endpoint, String path, MediaType contentType, Object body) throws IOException {
        String responseBody;
        try {
            responseBody = restClient.post()
                .uri(endpointUri(endpoint.baseUrl(), path))
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + endpoint.apiKey())
                .accept(MediaType.APPLICATION_JSON)
                .contentType(contentType)
                .body(body)
                .retrieve()
                .body(String.class);
        } catch (RestClientResponseException e) {
            throw new IOException("HTTP " + e.getStatusCode().value() + ": " + e.getResponseBodyAsString(), e);
        } catch (RestClientException e) {
            throw new IOException("图片接口请求失败: " + endpoint.baseUrl(), e);
        }
        try {
            return objectMapper.readTree(responseBody == null ? "" : responseBody);
        } catch (Exception e) {
            throw new IOException("图片接口响应解析失败: " + endpoint.baseUrl(), e);
        }
    }

    private URI endpointUri(String baseUrl, String path) {
        String base = baseUrl == null ? "" : baseUrl.trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return URI.create(base + path);
    }

    private MultiValueMap<String, HttpEntity<?>> multipartBody(String prompt, TaskParamsResponse params, List<ImageFileInput> imageFiles, ImageFileInput maskFile, boolean codexCli) {
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("model", appConfigService.model());
        builder.part("prompt", codexCli ? codexPrompt(prompt) : prompt);
        builder.part("size", params.size());
        builder.part("output_format", params.outputFormat());
        if (!"png".equals(params.outputFormat()) && params.outputCompression() != null) {
            builder.part("output_compression", String.valueOf(params.outputCompression()));
        }
        String imageField = imageFiles != null && imageFiles.size() > 1 ? "image[]" : "image";
        if (imageFiles != null) {
            for (int i = 0; i < imageFiles.size(); i++) {
                ImageFileInput image = imageFiles.get(i);
                addFilePart(builder, imageField, "input-" + (i + 1) + "." + extensionForMime(image.mime()), image.mime(), image.data());
            }
        }
        if (maskFile != null) {
            addFilePart(builder, "mask", "mask." + extensionForMime(maskFile.mime()), maskFile.mime(), maskFile.data());
        }
        return builder.build();
    }

    private void addFilePart(MultipartBodyBuilder builder, String name, String filename, String mime, byte[] data) {
        builder.part(name, new NamedByteArrayResource(filename, data == null ? new byte[0] : data))
            .contentType(MediaType.parseMediaType(mime == null || mime.isBlank() ? "image/png" : mime));
    }

    private ClientHttpRequestFactory requestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) CONNECT_TIMEOUT.toMillis());
        factory.setReadTimeout((int) REQUEST_TIMEOUT.toMillis());
        return factory;
    }

    private String extensionForMime(String mime) {
        return switch (mime == null ? "" : mime) {
            case "image/jpeg", "image/jpg" -> "jpg";
            case "image/webp" -> "webp";
            case "image/gif" -> "gif";
            case "image/bmp" -> "bmp";
            default -> "png";
        };
    }

    private ImageGenerationResult convertImagesResponse(JsonNode response, TaskParamsResponse params) {
        TaskParamsResponse actualParams = actualParamsFromResponse(response);

        String fallbackTier = ImageSizeUtils.POOL_AUTO.equals(params.size()) ? "" : ImageSizeUtils.tierForSize(params.size());
        String actualTier = ImageSizeUtils.tierFromActualParams(actualParams);
        String outputFormat = actualParams == null || actualParams.outputFormat() == null ? params.outputFormat() : actualParams.outputFormat();
        String mime = mimeForFormat(outputFormat);
        List<GeneratedImage> images = new ArrayList<>();
        JsonNode data = response.get("data");
        if (data != null && data.isArray()) {
            for (JsonNode item : data) {
                String b64 = text(item.get("b64_json"));
                if (b64 == null) {
                    b64 = text(item.get("b64JSON"));
                }
                if (b64 == null || b64.isBlank()) {
                    continue;
                }
                if (!b64.startsWith("data:")) {
                    b64 = "data:" + mime + ";base64," + b64;
                }
                String sizeTier = actualTier == null || actualTier.isBlank() ? fallbackTier : actualTier;
                images.add(new GeneratedImage(
                    b64,
                    actualParams,
                    text(item.get("revised_prompt")),
                    "",
                    sizeTier,
                    0L,
                    0L,
                    0L,
                    0L
                ));
            }
        }
        return new ImageGenerationResult(images, actualParams);
    }

    private TaskParamsResponse actualParamsFromResponse(JsonNode response) {
        String size = text(response.get("size"));
        String quality = text(response.get("quality"));
        String outputFormat = text(response.get("output_format"));
        if (isBlank(size) && isBlank(quality) && isBlank(outputFormat)) {
            return null;
        }
        return new TaskParamsResponse(
            blankToNull(size),
            null,
            blankToNull(quality),
            blankToNull(outputFormat),
            null,
            null,
            null
        );
    }

    private String text(JsonNode node) {
        return node == null || node.isNull() ? null : node.asText();
    }

    private String mimeForFormat(String outputFormat) {
        return switch (outputFormat == null ? "" : outputFormat) {
            case "jpeg", "jpg" -> "image/jpeg";
            case "webp" -> "image/webp";
            default -> "image/png";
        };
    }

    private ImageGenerationResult withEndpointAttribution(ImageGenerationResult result, ApiEndpointResponse endpoint) {
        List<GeneratedImage> images = result.images() == null ? List.of() : result.images();
        List<GeneratedImage> attributed = images.stream()
            .map(image -> image.withEndpoint(
                endpoint.baseUrl(),
                zero(endpoint.cost1KX10000()),
                zero(endpoint.cost2KX10000()),
                zero(endpoint.cost4KX10000())
            ))
            .toList();
        return new ImageGenerationResult(attributed, result.actualParams());
    }

    private long zero(Long value) {
        return value == null ? 0L : value;
    }

    private ImageGenerationResult runConcurrent(int n, ConcurrentCall call) {
        List<CompletableFuture<ImageGenerationResult>> futures = new ArrayList<>();
        Exception lastError = null;
        for (int i = 0; i < n; i++) {
            try {
                futures.add(CompletableFuture.supplyAsync(() -> {
                    try {
                        return call.execute();
                    } catch (Exception e) {
                        throw new ConcurrentGenerationException(e);
                    }
                }, concurrentExecutor));
            } catch (TaskRejectedException e) {
                lastError = e;
            } catch (RejectedExecutionException e) {
                lastError = e;
            }
        }
        List<GeneratedImage> images = new ArrayList<>();
        TaskParamsResponse firstActual = null;
        for (CompletableFuture<ImageGenerationResult> future : futures) {
            try {
                ImageGenerationResult result = future.join();
                if (result == null) {
                    continue;
                }
                if (firstActual == null && result.actualParams() != null) {
                    firstActual = result.actualParams();
                }
                if (result.images() != null) {
                    images.addAll(result.images());
                }
            } catch (Exception e) {
                lastError = unwrapConcurrentError(e);
            }
        }
        if (images.isEmpty()) {
            throw new IllegalStateException(lastError == null ? "所有并发请求均失败" : "所有并发请求均失败: " + lastError.getMessage(), lastError);
        }
        TaskParamsResponse mergedActual = new TaskParamsResponse(
            firstActual == null ? null : firstActual.size(),
            firstActual == null ? null : firstActual.tier(),
            firstActual == null ? null : firstActual.quality(),
            firstActual == null ? null : firstActual.outputFormat(),
            firstActual == null ? null : firstActual.outputCompression(),
            firstActual == null ? null : firstActual.moderation(),
            images.size()
        );
        return new ImageGenerationResult(images, mergedActual);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String codexPrompt(String prompt) {
        return "Use the following text as the complete prompt. Do not rewrite it:\n" + prompt;
    }

    private Runnable once(Runnable runnable) {
        AtomicBoolean called = new AtomicBoolean();
        return () -> {
            if (runnable != null && called.compareAndSet(false, true)) {
                runnable.run();
            }
        };
    }

    private Exception unwrapConcurrentError(Exception error) {
        Throwable cause = error;
        if (cause instanceof CompletionException && cause.getCause() != null) {
            cause = cause.getCause();
        }
        if (cause instanceof ConcurrentGenerationException && cause.getCause() != null) {
            cause = cause.getCause();
        }
        return cause instanceof Exception exception ? exception : error;
    }

    private interface EndpointCall {
        ImageGenerationResult execute(ApiEndpointResponse endpoint) throws Exception;
    }

    private interface ConcurrentCall {
        ImageGenerationResult execute();
    }

    private static final class EndpointFailure extends RuntimeException {
        private final int endpointIndex;

        private EndpointFailure(int endpointIndex, Throwable cause) {
            super(cause);
            this.endpointIndex = endpointIndex;
        }
    }

    private static final class ConcurrentGenerationException extends RuntimeException {
        private ConcurrentGenerationException(Throwable cause) {
            super(cause);
        }
    }

    private static final class NamedByteArrayResource extends ByteArrayResource {
        private final String filename;

        private NamedByteArrayResource(String filename, byte[] byteArray) {
            super(byteArray);
            this.filename = filename;
        }

        @Override
        public String getFilename() {
            return filename;
        }
    }
}
