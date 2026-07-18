package com.tripcanvas.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.tripcanvas.backend.dto.TemplateInputs;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record TaskRecordResponse(
    String id,
    String prompt,
    String promptMode,
    String templateId,
    String templateResolutionId,
    String templateResolutionName,
    String templateQualityId,
    String templateQualityName,
    String templateTitle,
    Integer templateVersion,
    Integer creditCost,
    TemplateInputs templateInputs,
    String userPrompt,
    @JsonIgnore String assembledPrompt,
    TaskParamsResponse params,
    TaskParamsResponse actualParams,
    Map<String, TaskParamsResponse> actualParamsByImage,
    Map<String, String> revisedPromptByImage,
    List<String> inputImageIds,
    String maskTargetImageId,
    String maskImageId,
    List<String> outputImages,
    String status,
    String error,
    Boolean isFavorite,
    long createdAt,
    Long finishedAt,
    Long elapsed,
    String apiMode,
    Boolean codexCli
) {
}
