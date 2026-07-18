package com.tripcanvas.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record PromptTemplateQualityOptionResponse(
    @Size(max = 64, message = "质量档位 ID 无效") String id,
    @Size(max = 100, message = "质量名称最多 100 个字符") String name,
    @Pattern(regexp = "auto|low|medium|high", message = "质量参数无效") String quality,
    @Min(value = 1, message = "积分消耗不能小于 1")
    @Max(value = 1000, message = "积分消耗不能大于 1000") Integer creditCost
) {
}
