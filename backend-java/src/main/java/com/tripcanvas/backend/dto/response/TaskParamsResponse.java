package com.tripcanvas.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record TaskParamsResponse(
    @Size(max = 32, message = "尺寸参数无效") String size,
    String tier,
    @Size(max = 32, message = "质量参数无效") String quality,
    @Pattern(regexp = "png|jpeg|jpg|webp", message = "输出格式无效") @JsonProperty("output_format") String outputFormat,
    @Min(value = 0, message = "输出压缩不能小于 0")
    @Max(value = 100, message = "输出压缩不能大于 100")
    @JsonProperty("output_compression") Integer outputCompression,
    String moderation,
    @Min(value = 1, message = "生成数量至少为 1")
    @Max(value = 10, message = "单次最多生成 10 张") Integer n
) {
}
