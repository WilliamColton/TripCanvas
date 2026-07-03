package com.tripcanvas.backend.service.impl;

import com.alicp.jetcache.Cache;
import com.alicp.jetcache.CacheManager;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripcanvas.backend.cache.CacheNames;
import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.config.JetCacheConfigs;
import com.tripcanvas.backend.config.TripCanvasProperties;
import com.tripcanvas.backend.dto.request.AdminRequests;
import com.tripcanvas.backend.dto.response.ApiEndpointResponse;
import com.tripcanvas.backend.dto.response.AppConfigResponse;
import com.tripcanvas.backend.service.AppConfigService;
import com.tripcanvas.backend.util.JsonUtils;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class AppConfigServiceImpl implements AppConfigService {
    private static final long MONEY_SCALE = 10000L;

    private final TripCanvasProperties properties;
    private final CacheManager cacheManager;
    private final ObjectMapper objectMapper = JsonUtils.mapper();
    private volatile RuntimeConfig config;

    private Cache<String, AppConfigResponse> publicConfigCache;

    @PostConstruct
    private void initCaches() {
        publicConfigCache = cacheManager.getOrCreateCache(
            JetCacheConfigs.local(CacheNames.PUBLIC_CONFIG, CacheNames.SINGLE_ENTRY_LIMIT)
        );
    }

    @PostConstruct
    public void load() throws IOException {
        Path configPath = properties.configFile().toAbsolutePath().normalize();
        Files.createDirectories(configPath.getParent());
        if (!Files.exists(configPath)) {
            Path example = configPath.resolveSibling("config.example.json");
            if (Files.exists(example)) {
                Files.copy(example, configPath);
                log.warn("未找到 config.json，已从 config.example.json 复制一份到 {}。请修改其中的敏感配置（jwtSecret / adminApikey / resendApiKey / apiEndpoints[].apiKey 等）后再使用。", configPath);
            }
        }
        RuntimeConfig loaded = defaultConfig();
        Map<String, JsonNode> raw = readRawConfig();
        if (!raw.isEmpty()) {
            loaded = objectMapper.convertValue(raw, RuntimeConfig.class);
            loaded.applyDefaults(properties.rootDir().toString());
        }
        loaded.apiEndpointsAuto = sorted(loadEndpointPool(raw, "apiEndpointsAuto", loaded.apiEndpointsAuto, "auto"));
        loaded.apiEndpoints1K = sorted(loadEndpointPool(raw, "apiEndpoints1K", loaded.apiEndpoints1K, "1K"));
        loaded.apiEndpoints2K = sorted(loadEndpointPool(raw, "apiEndpoints2K", loaded.apiEndpoints2K, "2K"));
        loaded.apiEndpoints4K = sorted(loadEndpointPool(raw, "apiEndpoints4K", loaded.apiEndpoints4K, "4K"));
        if (loaded.apiEndpointsAuto.isEmpty() && loaded.apiEndpoints1K.isEmpty() && loaded.apiEndpoints2K.isEmpty() && loaded.apiEndpoints4K.isEmpty() && raw.containsKey("apiEndpoints")) {
            loaded.apiEndpointsAuto = sorted(loadEndpointPool(raw, "apiEndpoints", List.of(), "auto"));
        }
        if (loaded.salePricingMode == null || loaded.salePricingMode.isBlank()) {
            loaded.salePricingMode = "unified";
        }
        if (loaded.salePrice1KX10000 <= 0 && loaded.salePriceX10000 > 0) {
            loaded.salePrice1KX10000 = loaded.salePriceX10000;
        }
        if (loaded.salePrice2KX10000 <= 0 && loaded.salePriceX10000 > 0) {
            loaded.salePrice2KX10000 = loaded.salePriceX10000;
        }
        if (loaded.salePrice4KX10000 <= 0 && loaded.salePriceX10000 > 0) {
            loaded.salePrice4KX10000 = loaded.salePriceX10000;
        }
        this.config = loaded;
        if ("change-me".equals(loaded.jwtSecret)) {
            log.warn("JWTSecret 仍为默认值，请立即更改为强随机字符串");
        }
        if ("change-me-admin-apikey".equals(loaded.adminApikey)) {
            log.warn("AdminApikey 仍为默认值，请立即更改为强随机字符串");
        }
        if ("change-me-resend".equals(loaded.resendApiKey)) {
            log.warn("ResendApiKey 仍为默认值，邮箱注册将无法发送验证邮件，请在 config.json 中配置 resendApiKey");
        }
    }

    @Override
    public MailConfig mailConfig() {
        RuntimeConfig c = config;
        int ttl = c.emailVerificationTtlSeconds <= 0 ? 600 : c.emailVerificationTtlSeconds;
        return new MailConfig(c.resendApiKey, c.resendFrom, ttl);
    }

    @Override
    public EmailConfig emailConfig() {
        RuntimeConfig c = config;
        return new EmailConfig(c.allowedEmailSuffixes == null ? List.of() : List.copyOf(c.allowedEmailSuffixes));
    }

    @Override
    public synchronized EmailConfig setEmailConfig(AdminRequests.EmailConfigRequest request) {
        List<String> normalized = new ArrayList<>();
        if (request.allowedSuffixes() != null) {
            for (String raw : request.allowedSuffixes()) {
                if (raw == null) {
                    continue;
                }
                String s = raw.trim().toLowerCase(Locale.ROOT);
                if (s.isEmpty()) {
                    continue;
                }
                if (!s.startsWith("@")) {
                    s = "@" + s;
                }
                if (!normalized.contains(s)) {
                    normalized.add(s);
                }
            }
        }
        RuntimeConfig next = config.copy();
        next.allowedEmailSuffixes = normalized;
        write(next);
        config = next;
        publicConfigCache.remove(CacheNames.KEY_PUBLIC_CONFIG);
        return new EmailConfig(List.copyOf(normalized));
    }

    @Override
    public AppConfigResponse publicConfig() {
        AppConfigResponse cached = publicConfigCache.get(CacheNames.KEY_PUBLIC_CONFIG);
        if (cached != null) {
            return cached;
        }
        RuntimeConfig c = config;
        AppConfigResponse response = new AppConfigResponse(
            c.codexCli,
            c.apiMode,
            c.model,
            c.timeout,
            Boolean.TRUE.equals(c.inviteEnabled),
            c.allowedEmailSuffixes == null ? List.of() : List.copyOf(c.allowedEmailSuffixes)
        );
        publicConfigCache.put(CacheNames.KEY_PUBLIC_CONFIG, response);
        return response;
    }

    @Override
    public String jwtSecret() {
        return config.jwtSecret;
    }

    @Override
    public String adminApikey() {
        return config.adminApikey;
    }

    @Override
    public String model() {
        return config.model;
    }

    @Override
    public String apiMode() {
        return config.apiMode;
    }

    @Override
    public int timeout() {
        return config.timeout;
    }

    @Override
    public boolean codexCli() {
        return config.codexCli;
    }

    @Override
    public List<ApiEndpointResponse> endpointPool(String pool) {
        RuntimeConfig c = config;
        return clonePool(switch (pool) {
            case "1K" -> c.apiEndpoints1K;
            case "2K" -> c.apiEndpoints2K;
            case "4K" -> c.apiEndpoints4K;
            default -> c.apiEndpointsAuto;
        }, pool);
    }

    @Override
    public synchronized void setEndpointPools(AdminRequests.EndpointPoolsRequest request) {
        List<ApiEndpointResponse> auto = validateEndpointPool(request.endpointsAuto(), "自动");
        List<ApiEndpointResponse> one = validateEndpointPool(request.endpoints1K(), "1K");
        List<ApiEndpointResponse> two = validateEndpointPool(request.endpoints2K(), "2K");
        List<ApiEndpointResponse> four = validateEndpointPool(request.endpoints4K(), "4K");

        RuntimeConfig next = config.copy();
        next.apiEndpointsAuto = sorted(auto);
        next.apiEndpoints1K = sorted(one);
        next.apiEndpoints2K = sorted(two);
        next.apiEndpoints4K = sorted(four);
        write(next);
        config = next;
    }

    @Override
    public PricingConfig pricingConfig() {
        RuntimeConfig c = config;
        return new PricingConfig(
            endpointPool("auto"),
            endpointPool("1K"),
            endpointPool("2K"),
            endpointPool("4K"),
            c.salePriceX10000,
            salePricingMode(),
            c.salePrice1KX10000,
            c.salePrice2KX10000,
            c.salePrice4KX10000,
            MONEY_SCALE
        );
    }

    @Override
    public synchronized PricingConfig setPricingConfig(AdminRequests.PricingConfigRequest request) {
        String mode = request.salePricingMode() == null || request.salePricingMode().isBlank() ? "unified" : request.salePricingMode();
        if (!"unified".equals(mode) && !"per_resolution".equals(mode)) {
            throw ApiException.badRequest("售价模式无效，只能为 unified 或 per_resolution");
        }
        long sale = positiveOrZero(request.salePriceX10000());
        long sale1K = positiveOrZero(request.salePrice1KX10000());
        long sale2K = positiveOrZero(request.salePrice2KX10000());
        long sale4K = positiveOrZero(request.salePrice4KX10000());

        List<ApiEndpointResponse> auto = validateEndpointPool(request.endpointsAuto(), "自动");
        List<ApiEndpointResponse> one = validateEndpointPool(request.endpoints1K(), "1K");
        List<ApiEndpointResponse> two = validateEndpointPool(request.endpoints2K(), "2K");
        List<ApiEndpointResponse> four = validateEndpointPool(request.endpoints4K(), "4K");

        RuntimeConfig next = config.copy();
        next.apiEndpointsAuto = sorted(auto);
        next.apiEndpoints1K = sorted(one);
        next.apiEndpoints2K = sorted(two);
        next.apiEndpoints4K = sorted(four);
        next.salePricingMode = mode;
        next.salePriceX10000 = sale;
        next.salePrice1KX10000 = sale1K;
        next.salePrice2KX10000 = sale2K;
        next.salePrice4KX10000 = sale4K;
        write(next);
        config = next;
        return pricingConfig();
    }

    @Override
    public InviteConfig inviteConfig() {
        RuntimeConfig c = config;
        return new InviteConfig(nonNegative(c.inviteInviterReward), nonNegative(c.inviteInviteeReward), nonNegative(c.inviteDefaultQuota), Boolean.TRUE.equals(c.inviteEnabled));
    }

    @Override
    public synchronized InviteConfig setInviteConfig(AdminRequests.InviteConfigRequest request) {
        int inviter = nonNegative(request.inviterReward());
        int invitee = nonNegative(request.inviteeReward());
        int quota = nonNegative(request.defaultQuota());
        boolean enabled = Boolean.TRUE.equals(request.inviteEnabled());
        RuntimeConfig next = config.copy();
        next.inviteInviterReward = inviter;
        next.inviteInviteeReward = invitee;
        next.inviteDefaultQuota = quota;
        next.inviteEnabled = enabled;
        write(next);
        config = next;
        publicConfigCache.remove(CacheNames.KEY_PUBLIC_CONFIG);
        return inviteConfig();
    }

    @Override
    public long salePriceForTier(String tier) {
        RuntimeConfig c = config;
        if (!"per_resolution".equals(salePricingMode())) {
            return c.salePriceX10000;
        }
        return switch (tier) {
            case "1K" -> c.salePrice1KX10000;
            case "2K" -> c.salePrice2KX10000;
            case "4K" -> c.salePrice4KX10000;
            default -> 0L;
        };
    }

    private String salePricingMode() {
        return config.salePricingMode == null || config.salePricingMode.isBlank() ? "unified" : config.salePricingMode;
    }

    private Map<String, JsonNode> readRawConfig() throws IOException {
        Path path = properties.configFile().toAbsolutePath().normalize();
        if (!Files.exists(path)) {
            return new LinkedHashMap<>();
        }
        return objectMapper.readValue(path.toFile(), new TypeReference<Map<String, JsonNode>>() {});
    }

    private void write(RuntimeConfig next) {
        try {
            Map<String, Object> raw = objectMapper.convertValue(next, new TypeReference<Map<String, Object>>() {});
            raw.remove("rootDir");
            raw.remove("dataDir");
            raw.remove("uploadDir");
            raw.remove("apiEndpoints");
            Path path = properties.configFile().toAbsolutePath().normalize();
            Path tmp = path.resolveSibling(path.getFileName() + ".tmp");
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(tmp.toFile(), raw);
            Files.move(tmp, path, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (Exception e) {
            throw ApiException.internal("保存配置失败，请重试");
        }
    }

    private RuntimeConfig defaultConfig() {
        RuntimeConfig c = new RuntimeConfig();
        c.applyDefaults(properties.rootDir().toString());
        return c;
    }

    private List<ApiEndpointResponse> loadEndpointPool(Map<String, JsonNode> raw, String key, List<ApiEndpointResponse> fallback, String pool) {
        JsonNode node = raw.get(key);
        if (node == null || node.isNull()) {
            return clonePool(fallback, pool);
        }
        List<ApiEndpointResponse> endpoints = objectMapper.convertValue(node, new TypeReference<List<ApiEndpointResponse>>() {});
        return clonePool(endpoints, pool);
    }

    private List<ApiEndpointResponse> validateEndpointPool(List<ApiEndpointResponse> endpoints, String tierLabel) {
        List<ApiEndpointResponse> result = new ArrayList<>();
        if (endpoints == null) {
            return result;
        }
        for (int i = 0; i < endpoints.size(); i++) {
            ApiEndpointResponse ep = endpoints.get(i);
            String baseUrl = ep.baseUrl() == null ? "" : ep.baseUrl().trim();
            String apiKey = ep.apiKey() == null ? "" : ep.apiKey().trim();
            if (baseUrl.isEmpty()) {
                throw ApiException.badRequest("%s 第 %d 个端点缺少 baseUrl".formatted(tierLabel, i + 1));
            }
            if (apiKey.isEmpty()) {
                throw ApiException.badRequest("%s 第 %d 个端点缺少 apiKey".formatted(tierLabel, i + 1));
            }
            try {
                URI uri = URI.create(baseUrl);
                if (uri.getScheme() == null || uri.getHost() == null) {
                    throw new IllegalArgumentException();
                }
            } catch (Exception e) {
                throw ApiException.badRequest("%s 第 %d 个端点 baseUrl 无效".formatted(tierLabel, i + 1));
            }
            if (ep.maxConcurrency() != null && ep.maxConcurrency() < 0 || ep.priority() != null && ep.priority() < 0) {
                throw ApiException.badRequest("%s 第 %d 个端点参数不能小于 0".formatted(tierLabel, i + 1));
            }
            if (isNegative(ep.costPerImageX10000()) || isNegative(ep.cost1KX10000()) || isNegative(ep.cost2KX10000()) || isNegative(ep.cost4KX10000())) {
                throw ApiException.badRequest("%s 第 %d 个端点成本价不能小于 0".formatted(tierLabel, i + 1));
            }
            result.add(new ApiEndpointResponse(
                baseUrl,
                apiKey,
                nonNegative(ep.maxConcurrency()),
                nonNegative(ep.priority()),
                positiveOrZero(ep.costPerImageX10000()),
                positiveOrZero(ep.cost1KX10000()),
                positiveOrZero(ep.cost2KX10000()),
                positiveOrZero(ep.cost4KX10000()),
                ep.runtimePool()
            ));
        }
        return result;
    }

    private List<ApiEndpointResponse> sorted(List<ApiEndpointResponse> endpoints) {
        List<ApiEndpointResponse> cloned = new ArrayList<>(endpoints == null ? List.of() : endpoints);
        cloned.sort(Comparator.comparing((ApiEndpointResponse ep) -> nonNegative(ep.priority())).reversed());
        return cloned;
    }

    private List<ApiEndpointResponse> clonePool(List<ApiEndpointResponse> endpoints, String pool) {
        List<ApiEndpointResponse> cloned = new ArrayList<>();
        if (endpoints == null) {
            return cloned;
        }
        for (ApiEndpointResponse ep : endpoints) {
            cloned.add(new ApiEndpointResponse(
                ep.baseUrl(),
                ep.apiKey(),
                nonNegative(ep.maxConcurrency()),
                nonNegative(ep.priority()),
                positiveOrZero(ep.costPerImageX10000()),
                positiveOrZero(ep.cost1KX10000()),
                positiveOrZero(ep.cost2KX10000()),
                positiveOrZero(ep.cost4KX10000()),
                pool
            ));
        }
        return cloned;
    }

    private int nonNegative(Integer value) {
        if (value == null) {
            return 0;
        }
        if (value < 0) {
            throw ApiException.badRequest("奖励值不能为负数");
        }
        return value;
    }

    private long positiveOrZero(Long value) {
        if (value == null) {
            return 0L;
        }
        if (value < 0) {
            throw ApiException.badRequest("售价不能小于 0");
        }
        return value;
    }

    private boolean isNegative(Long value) {
        return value != null && value < 0;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RuntimeConfig {
        public String rootDir;
        public String dataDir;
        public String uploadDir;
        public int port;
        public String jwtSecret;
        public String adminApikey;
        public String model;
        public String apiMode;
        public int timeout;
        public boolean codexCli;
        public List<ApiEndpointResponse> apiEndpointsAuto = new ArrayList<>();
        public List<ApiEndpointResponse> apiEndpoints1K = new ArrayList<>();
        public List<ApiEndpointResponse> apiEndpoints2K = new ArrayList<>();
        public List<ApiEndpointResponse> apiEndpoints4K = new ArrayList<>();
        public long salePriceX10000;
        public String salePricingMode;
        public long salePrice1KX10000;
        public long salePrice2KX10000;
        public long salePrice4KX10000;
        public int inviteInviterReward;
        public int inviteInviteeReward;
        public int inviteDefaultQuota;
        public Boolean inviteEnabled;
        public String resendApiKey;
        public String resendFrom;
        public int emailVerificationTtlSeconds;
        public List<String> allowedEmailSuffixes = new ArrayList<>();

        public void applyDefaults(String root) {
            rootDir = rootDir == null ? root : rootDir;
            dataDir = dataDir == null ? root + "/data" : dataDir;
            uploadDir = uploadDir == null ? root + "/upload" : uploadDir;
            port = port == 0 ? 3001 : port;
            jwtSecret = jwtSecret == null ? "change-me" : jwtSecret;
            adminApikey = adminApikey == null ? "change-me-admin-apikey" : adminApikey;
            model = model == null ? "gpt-image-2" : model;
            apiMode = apiMode == null ? "images" : apiMode;
            timeout = timeout == 0 ? 6000 : timeout;
            inviteEnabled = inviteEnabled == null ? Boolean.TRUE : inviteEnabled;
            salePricingMode = salePricingMode == null ? "unified" : salePricingMode;
            resendApiKey = resendApiKey == null ? "change-me-resend" : resendApiKey;
            resendFrom = resendFrom == null ? "精品旅图 <noreply@jingpinlutu.com>" : resendFrom;
            emailVerificationTtlSeconds = emailVerificationTtlSeconds == 0 ? 600 : emailVerificationTtlSeconds;
            allowedEmailSuffixes = allowedEmailSuffixes == null ? new ArrayList<>() : allowedEmailSuffixes;
        }

        public RuntimeConfig copy() {
            RuntimeConfig c = new RuntimeConfig();
            c.rootDir = rootDir;
            c.dataDir = dataDir;
            c.uploadDir = uploadDir;
            c.port = port;
            c.jwtSecret = jwtSecret;
            c.adminApikey = adminApikey;
            c.model = model;
            c.apiMode = apiMode;
            c.timeout = timeout;
            c.codexCli = codexCli;
            c.apiEndpointsAuto = new ArrayList<>(apiEndpointsAuto);
            c.apiEndpoints1K = new ArrayList<>(apiEndpoints1K);
            c.apiEndpoints2K = new ArrayList<>(apiEndpoints2K);
            c.apiEndpoints4K = new ArrayList<>(apiEndpoints4K);
            c.salePriceX10000 = salePriceX10000;
            c.salePricingMode = salePricingMode;
            c.salePrice1KX10000 = salePrice1KX10000;
            c.salePrice2KX10000 = salePrice2KX10000;
            c.salePrice4KX10000 = salePrice4KX10000;
            c.inviteInviterReward = inviteInviterReward;
            c.inviteInviteeReward = inviteInviteeReward;
            c.inviteDefaultQuota = inviteDefaultQuota;
            c.inviteEnabled = inviteEnabled;
            c.resendApiKey = resendApiKey;
            c.resendFrom = resendFrom;
            c.emailVerificationTtlSeconds = emailVerificationTtlSeconds;
            c.allowedEmailSuffixes = new ArrayList<>(allowedEmailSuffixes);
            return c;
        }

        @JsonIgnore
        public boolean isEmpty() {
            return false;
        }
    }
}
