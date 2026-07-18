package com.tripcanvas.backend.service.impl;

import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.dto.TemplateInputs;
import com.tripcanvas.backend.dto.request.GenerateRequest;
import com.tripcanvas.backend.dto.response.AuthUserResponse;
import com.tripcanvas.backend.dto.response.TaskParamsResponse;
import com.tripcanvas.backend.dto.response.TaskRecordResponse;
import com.tripcanvas.backend.service.AppConfigService;
import com.tripcanvas.backend.service.GenerationService;
import com.tripcanvas.backend.service.GenerationWorkerService;
import com.tripcanvas.backend.service.PromptTemplateService;
import com.tripcanvas.backend.service.TaskService;
import com.tripcanvas.backend.util.ImageSizeUtils;
import com.tripcanvas.backend.util.Times;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GenerationServiceImpl implements GenerationService {
    private final TaskService taskService;
    private final PromptTemplateService templateService;
    private final AppConfigService appConfigService;
    private final GenerationWorkerService generationWorkerService;

    @Override
    public SubmitResult submit(AuthUserResponse user, GenerateRequest request, boolean edit) {
        String userId = user.id();
        if (request == null) {
            throw ApiException.badRequest("请求参数无效");
        }
        if (request.taskId() == null || request.taskId().isBlank()) {
            throw ApiException.badRequest("缺少 taskId");
        }
        TaskParamsResponse params;
        try {
            params = ImageSizeUtils.normalizeTaskParams(request.params());
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest(e.getMessage());
        }
        String prompt = request.prompt() == null ? "" : request.prompt().trim();
        String promptMode = request.promptMode() == null || request.promptMode().isBlank() ? "freeform" : request.promptMode();
        String assembledPrompt = prompt;
        String templateTitle = "";
        Integer templateVersion = 0;
        int templateCreditCost = 1;
        String templateResolutionId = null;
        String templateResolutionName = null;
        String templateQualityId = null;
        String templateQualityName = null;
        TemplateInputs templateInputs = request.templateInputs();
        if ("template".equals(promptMode) || request.templateId() != null && !request.templateId().isBlank()) {
            promptMode = "template";
            PromptTemplateService.PromptAssembly assembly = templateService.assemblePrompt(
                userId,
                request.templateId(),
                request.templateInputs(),
                request.additionalPrompt(),
                new PromptTemplateService.PromptAssemblyContext(request.inputImageIds() != null && !request.inputImageIds().isEmpty(), edit)
            );
            prompt = assembly.displayPrompt();
            assembledPrompt = assembly.assembledPrompt();
            templateTitle = assembly.template().title();
            templateVersion = assembly.template().version();
            templateCreditCost = assembly.template().creditCost();
            templateInputs = assembly.inputs();
            PromptTemplateService.ResolvedResolutionOption resolution = templateService.resolveResolution(userId, request.templateId(), request.templateResolutionId());
            PromptTemplateService.ResolvedQualityOption quality = templateService.resolveQuality(userId, request.templateId(), request.templateQualityId());
            params = withSizeAndQuality(
                params,
                resolution == null ? ImageSizeUtils.POOL_AUTO : resolution.size(),
                quality == null ? "auto" : quality.quality()
            );
            if (resolution != null) {
                templateResolutionId = resolution.id();
                templateResolutionName = resolution.name();
            }
            if (quality != null) {
                templateQualityId = quality.id();
                templateQualityName = quality.name();
                templateCreditCost = quality.creditCost() == null ? templateCreditCost : quality.creditCost();
            }
        }
        if (assembledPrompt == null || assembledPrompt.isBlank()) {
            throw ApiException.badRequest("缺少 prompt");
        }
        List<String> inputIds = request.inputImageIds() == null ? List.of() : request.inputImageIds();
        int totalCreditCost = Math.max(1, params.n()) * Math.max(1, templateCreditCost);
        Long now = Times.nowMillis();
        TaskRecordResponse task = new TaskRecordResponse(
            request.taskId(),
            prompt,
            promptMode,
            request.templateId(),
            templateResolutionId,
            templateResolutionName,
            templateQualityId,
            templateQualityName,
            templateTitle,
            templateVersion,
            totalCreditCost,
            templateInputs,
            "template".equals(promptMode) ? request.additionalPrompt() : prompt,
            assembledPrompt,
            params,
            null,
            null,
            null,
            inputIds,
            edit && !inputIds.isEmpty() ? inputIds.get(0) : null,
            request.maskImageId(),
            List.of(),
            "queued",
            null,
            false,
            now,
            null,
            null,
            appConfigService.apiMode(),
            Boolean.TRUE.equals(request.codexCli())
        );
        TaskService.QuotaCheckResult result = taskService.checkQuotaAndCreateTask(userId, task, totalCreditCost);
        if (!result.allowed()) {
            throw ApiException.forbidden(result.error());
        }
        generationWorkerService.enqueue(userId, user.label(), task);
        return new SubmitResult(task.id(), "queued");
    }

    private TaskParamsResponse withSizeAndQuality(TaskParamsResponse source, String size, String quality) {
        return new TaskParamsResponse(
            size,
            null,
            quality == null || quality.isBlank() ? "auto" : quality,
            source.outputFormat(),
            source.outputCompression(),
            source.moderation(),
            source.n()
        );
    }
}
