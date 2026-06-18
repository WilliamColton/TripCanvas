package com.tripcanvas.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record PromptTemplateResolutionOptionResponse(
    @Size(max = 64, message = "分辨率档位 ID 无效") String id,
    @Size(max = 100, message = "分辨率名称最多 100 个字符") String name,
    @Size(max = 32, message = "真实尺寸参数无效") String size
) {
}
