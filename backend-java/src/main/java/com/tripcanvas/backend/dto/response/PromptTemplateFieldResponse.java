package com.tripcanvas.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record PromptTemplateFieldResponse(
    @NotBlank(message = "字段 key 不能为空") @Size(max = 64, message = "字段 key 最多 64 个字符") String key,
    @Size(max = 100, message = "字段名称最多 100 个字符") String label,
    @Size(max = 32, message = "字段类型无效") String type,
    Boolean required,
    @Size(max = 200, message = "字段占位提示最多 200 个字符") String placeholder,
    @Size(max = 500, message = "字段帮助文本最多 500 个字符") String help,
    Object defaultValue,
    List<@Size(max = 200, message = "字段选项最多 200 个字符") String> options,
    @Min(value = 0, message = "字段长度限制无效") Integer maxLength
) {
}
