package com.tripcanvas.backend.service.impl;

import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.config.ExecutorConfig;
import com.tripcanvas.backend.dto.generation.GeneratedImage;
import com.tripcanvas.backend.dto.generation.ImageFileInput;
import com.tripcanvas.backend.dto.generation.ImageGenerationResult;
import com.tripcanvas.backend.dto.response.ApiEndpointResponse;
import com.tripcanvas.backend.dto.response.ImageResponse;
import com.tripcanvas.backend.dto.response.TaskParamsResponse;
import com.tripcanvas.backend.dto.response.TaskRecordResponse;
import com.tripcanvas.backend.service.AppConfigService;
import com.tripcanvas.backend.service.AuthService;
import com.tripcanvas.backend.service.BillingService;
import com.tripcanvas.backend.service.GenerationWorkerService;
import com.tripcanvas.backend.service.ImageGenerationClient;
import com.tripcanvas.backend.service.ImageService;
import com.tripcanvas.backend.service.TaskProgressBroadcaster;
import com.tripcanvas.backend.service.TaskService;
import com.tripcanvas.backend.util.DataUrlUtils;
import com.tripcanvas.backend.util.ImageSizeUtils;
import com.tripcanvas.backend.util.Times;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Future;
import java.util.concurrent.FutureTask;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class GenerationWorkerServiceImpl implements GenerationWorkerService {
    private final TaskService taskService;
    private final ImageService imageService;
    private final ImageGenerationClient imageGenerationClient;
    private final BillingService billingService;
    private final AppConfigService appConfigService;
    private final AuthService authService;
    private final TaskProgressBroadcaster broadcaster;
    private final AsyncTaskExecutor executor;
    private final Map<String, ActiveTask> activeTasks = new ConcurrentHashMap<>();

    public GenerationWorkerServiceImpl(
        TaskService taskService,
        ImageService imageService,
        ImageGenerationClient imageGenerationClient,
        BillingService billingService,
        AppConfigService appConfigService,
        AuthService authService,
        TaskProgressBroadcaster broadcaster,
        @Qualifier(ExecutorConfig.GENERATION_TASK_EXECUTOR) AsyncTaskExecutor executor
    ) {
        this.taskService = taskService;
        this.imageService = imageService;
        this.imageGenerationClient = imageGenerationClient;
        this.billingService = billingService;
        this.appConfigService = appConfigService;
        this.authService = authService;
        this.broadcaster = broadcaster;
        this.executor = executor;
    }

    @Override
    public void enqueue(String userId, String userLabel, TaskRecordResponse task) {
        FutureTask<Void> future = new FutureTask<>(() -> {
            execute(userId, userLabel, task);
            return null;
        });
        ActiveTask activeTask = new ActiveTask(userId, future);
        activeTasks.put(task.id(), activeTask);
        try {
            executor.execute(future);
        } catch (TaskRejectedException e) {
            activeTasks.remove(task.id(), activeTask);
            failTask(userId, task, "任务队列已满，请稍后重试");
            throw ApiException.serviceUnavailable("任务队列已满，请稍后重试");
        }
    }

    @Override
    public boolean cancel(String userId, String taskId) {
        ActiveTask active = activeTasks.get(taskId);
        if (active == null || !Objects.equals(active.userId(), userId)) {
            return false;
        }
        activeTasks.remove(taskId);
        return active.future().cancel(true);
    }

    @Override
    public void cancelUser(String userId) {
        activeTasks.forEach((taskId, active) -> {
            if (Objects.equals(active.userId(), userId)) {
                active.future().cancel(true);
                activeTasks.remove(taskId);
            }
        });
    }

    private void execute(String userId, String userLabel, TaskRecordResponse initialTask) {
        TaskRecordResponse task = initialTask;
        try {
            long start = Times.nowMillis();
            ImageSizeUtils.RouteResult route = ImageSizeUtils.routePoolForTaskParams(task.params());
            TaskParamsResponse params = route.params();
            task = copy(task, params, null, null, null, null, null, null, null, null, null, null);
            List<ApiEndpointResponse> endpoints = appConfigService.endpointPool(route.pool());
            if (endpoints.isEmpty()) {
                failTask(userId, task, "未配置 %s API 端点".formatted(route.pool()));
                return;
            }

            List<ImageFileInput> imageFiles = loadInputImages(userId, task.inputImageIds());
            ImageFileInput maskFile = loadMaskImage(userId, task.maskImageId());
            TaskRecordResponse runningTask = copy(task, params, null, null, null, "running", null, null, null, null, null, null);
            TaskRecordResponse[] taskRef = new TaskRecordResponse[] {task};
            String taskId = task.id();
            Runnable onAcquired = () -> {
                taskRef[0] = runningTask;
                try {
                    taskService.upsertTask(userId, runningTask);
                    broadcaster.publish(taskId, runningTask);
                } catch (Exception e) {
                    log.error("更新任务状态失败 userId={} taskId={}", userId, taskId, e);
                }
            };

            String generationPrompt = generationPrompt(task);
            ImageGenerationResult result = imageFiles.isEmpty()
                ? imageGenerationClient.generate(generationPrompt, params, params.n(), Boolean.TRUE.equals(task.codexCli()), onAcquired, endpoints)
                : imageGenerationClient.edit(generationPrompt, params, imageFiles, maskFile, params.n(), Boolean.TRUE.equals(task.codexCli()), onAcquired, endpoints);

            List<SavedGeneratedImage> saved = saveGeneratedImages(userId, finalizeAttribution(result.images(), route.requestTier()));
            List<String> outputIds = saved.stream().map(SavedGeneratedImage::outputImageId).toList();
            Map<String, TaskParamsResponse> actualParamsByImage = actualParamsByImage(saved);
            Map<String, String> revisedPromptByImage = isTemplateTask(task) ? null : revisedPromptByImage(saved);
            long now = Times.nowMillis();
            TaskRecordResponse done = copy(
                taskRef[0],
                params,
                result.actualParams(),
                actualParamsByImage,
                revisedPromptByImage,
                "done",
                null,
                outputIds,
                now,
                now - start,
                null,
                null
            );

            if (saved.isEmpty()) {
                failTask(userId, taskRef[0], "生成接口未返回有效图片");
                return;
            }
            if (Thread.currentThread().isInterrupted()) {
                deleteSavedImages(userId, saved);
                log.warn("任务已取消 userId={} taskId={}", userId, initialTask.id());
                return;
            }
            try {
                billingService.finalizeSuccessfulTask(userId, done, buildBillingInput(done.id(), userId, userLabel, route.requestTier(), saved), taskCreditCost(done));
            } catch (Exception e) {
                deleteSavedImages(userId, saved);
                throw e;
            }
            broadcaster.publish(done.id(), done);
            // finalize 在事务内已改 used_count，事务已提交（成功返回）；evict 让该用户的 findAuthUserById 重新读新值
            authService.evictUserCache(userId);
        } catch (Exception e) {
            if (Thread.currentThread().isInterrupted()) {
                log.warn("任务已取消 userId={} taskId={}", userId, initialTask.id());
                return;
            }
            failTask(userId, task, e.getMessage() == null ? "生成失败" : e.getMessage());
        } finally {
            activeTasks.remove(initialTask.id());
        }
    }

    private List<ImageFileInput> loadInputImages(String userId, List<String> ids) throws Exception {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        List<ImageFileInput> result = new ArrayList<>();
        for (String id : ids) {
            ImageService.ImageBytes ib = imageService.readBytesAndMimeForUser(userId, id);
            result.add(new ImageFileInput(ib.bytes(), ib.mime()));
        }
        return result;
    }

    private ImageFileInput loadMaskImage(String userId, String maskImageId) throws Exception {
        if (maskImageId == null || maskImageId.isBlank()) {
            return null;
        }
        ImageService.ImageBytes ib = imageService.readBytesAndMimeForUser(userId, maskImageId);
        return new ImageFileInput(ib.bytes(), ib.mime());
    }

    private List<GeneratedImage> finalizeAttribution(List<GeneratedImage> images, String requestTier) {
        if (images == null || images.isEmpty()) {
            return List.of();
        }
        List<GeneratedImage> result = new ArrayList<>();
        for (GeneratedImage image : images) {
            String tier = image.sizeTier();
            if (tier == null || tier.isBlank()) {
                tier = ImageSizeUtils.tierFromActualParams(image.actualParams());
            }
            if (tier == null || tier.isBlank()) {
                tier = ImageSizeUtils.tierFromDataUrl(image.base64());
            }
            if (tier == null || tier.isBlank()) {
                tier = requestTier;
            }
            result.add(image.withSizeTier(tier));
        }
        return result;
    }

    private List<SavedGeneratedImage> saveGeneratedImages(String userId, List<GeneratedImage> images) {
        List<SavedGeneratedImage> saved = new ArrayList<>();
        for (GeneratedImage image : images) {
            try {
                DataUrlUtils.ParsedDataUrl parsed = DataUrlUtils.parse(image.base64());
                ImageResponse response = imageService.saveImageBuffer(userId, parsed.bytes(), parsed.mime(), "generated");
                saved.add(new SavedGeneratedImage(response.id(), image));
            } catch (Exception e) {
                log.error("保存生成图片失败 userId={}", userId, e);
            }
        }
        return saved;
    }

    private void deleteSavedImages(String userId, List<SavedGeneratedImage> saved) {
        for (SavedGeneratedImage image : saved) {
            try {
                imageService.deleteImageForUser(userId, image.outputImageId());
            } catch (Exception e) {
                log.error("清理生成图片失败 userId={} imageId={}", userId, image.outputImageId(), e);
            }
        }
    }

    private BillingService.BillingBatchInput buildBillingInput(String taskId, String userId, String userLabel, String requestTier, List<SavedGeneratedImage> saved) {
        List<BillingService.BillingImageInput> images = saved.stream()
            .map(item -> {
                String imageSize = item.generated().sizeTier() == null || item.generated().sizeTier().isBlank() ? requestTier : item.generated().sizeTier();
                return new BillingService.BillingImageInput(
                    item.outputImageId(),
                    item.generated().endpointBaseUrl(),
                    imageSize,
                    item.generated().unitCostX10000(),
                    appConfigService.salePriceForTier(imageSize)
                );
            })
            .toList();
        return new BillingService.BillingBatchInput(taskId, userId, userLabel, requestTier, images, 0L);
    }

    private Map<String, TaskParamsResponse> actualParamsByImage(List<SavedGeneratedImage> saved) {
        Map<String, TaskParamsResponse> result = new LinkedHashMap<>();
        for (SavedGeneratedImage image : saved) {
            if (image.generated().actualParams() != null) {
                result.put(image.outputImageId(), image.generated().actualParams());
            }
        }
        return result.isEmpty() ? null : result;
    }

    private Map<String, String> revisedPromptByImage(List<SavedGeneratedImage> saved) {
        Map<String, String> result = new LinkedHashMap<>();
        for (SavedGeneratedImage image : saved) {
            if (image.generated().revisedPrompt() != null && !image.generated().revisedPrompt().isBlank()) {
                result.put(image.outputImageId(), image.generated().revisedPrompt());
            }
        }
        return result.isEmpty() ? null : result;
    }

    private void failTask(String userId, TaskRecordResponse task, String message) {
        String error = cleanTemplateTaskError(task, message);
        log.error("任务失败 userId={} taskId={} error={}", userId, task.id(), error);
        long now = Times.nowMillis();
        TaskRecordResponse failed = copy(task, null, null, null, null, "error", error, null, now, now - task.createdAt(), null, null);
        taskService.upsertTask(userId, failed);
        broadcaster.publish(task.id(), failed);
    }

    private String generationPrompt(TaskRecordResponse task) {
        if (isTemplateTask(task) && task.assembledPrompt() != null && !task.assembledPrompt().isBlank()) {
            return task.assembledPrompt();
        }
        return task.prompt();
    }

    private boolean isTemplateTask(TaskRecordResponse task) {
        return task != null && "template".equals(task.promptMode());
    }

    private String cleanTemplateTaskError(TaskRecordResponse task, String message) {
        String error = message == null || message.isBlank() ? "生成失败" : message.trim();
        if (isTemplateTask(task) && task.assembledPrompt() != null && !task.assembledPrompt().isBlank()) {
            error = error.replace(task.assembledPrompt(), "[已隐藏提示词]");
        }
        if (error.codePointCount(0, error.length()) > 300) {
            return error.substring(0, error.offsetByCodePoints(0, 300)) + "...";
        }
        return error;
    }

    private TaskRecordResponse copy(
        TaskRecordResponse source,
        TaskParamsResponse params,
        TaskParamsResponse actualParams,
        Map<String, TaskParamsResponse> actualParamsByImage,
        Map<String, String> revisedPromptByImage,
        String status,
        String error,
        List<String> outputImages,
        Long finishedAt,
        Long elapsed,
        String apiMode,
        Boolean codexCli
    ) {
        return new TaskRecordResponse(
            source.id(),
            source.prompt(),
            source.promptMode(),
            source.templateId(),
            source.templateResolutionId(),
            source.templateResolutionName(),
            source.templateTitle(),
            source.templateVersion(),
            source.creditCost(),
            source.templateInputs(),
            source.userPrompt(),
            source.assembledPrompt(),
            params == null ? source.params() : params,
            actualParams == null ? source.actualParams() : actualParams,
            actualParamsByImage == null ? source.actualParamsByImage() : actualParamsByImage,
            revisedPromptByImage == null ? source.revisedPromptByImage() : revisedPromptByImage,
            source.inputImageIds(),
            source.maskTargetImageId(),
            source.maskImageId(),
            outputImages == null ? source.outputImages() : outputImages,
            status == null ? source.status() : status,
            error,
            source.isFavorite(),
            source.createdAt(),
            finishedAt == null ? source.finishedAt() : finishedAt,
            elapsed == null ? source.elapsed() : elapsed,
            apiMode == null ? source.apiMode() : apiMode,
            codexCli == null ? source.codexCli() : codexCli
        );
    }

    private int taskCreditCost(TaskRecordResponse task) {
        if (task.creditCost() != null && task.creditCost() > 0) {
            return task.creditCost();
        }
        return TaskService.normalizeTaskN(task.params() == null ? null : task.params().n());
    }

    private record ActiveTask(String userId, Future<?> future) {
    }

    private record SavedGeneratedImage(String outputImageId, GeneratedImage generated) {
    }
}
