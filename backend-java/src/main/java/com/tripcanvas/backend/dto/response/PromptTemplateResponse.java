package com.tripcanvas.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record PromptTemplateResponse(
    String id,
    String ownerUserId,
    String source,
    String visibility,
    String title,
    String category,
    String description,
    List<PromptTemplateFieldResponse> fieldSchema,
    List<PromptTemplateResolutionOptionResponse> resolutionOptions,
    String previewImageId,
    String promptBody,
    String negativePrompt,
    String assemblyMode,
    String status,
    int sortOrder,
    int version,
    long createdAt,
    long updatedAt,
    Long publishedAt
) {
}
