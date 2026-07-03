package com.tripcanvas.backend.dto.request;

import com.tripcanvas.backend.dto.TemplateInputs;
import com.tripcanvas.backend.dto.response.PromptTemplateFieldResponse;
import com.tripcanvas.backend.dto.response.PromptTemplateResolutionOptionResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class TemplateRequests {
    private TemplateRequests() {
    }

    public record PromptTemplateRequest(
        @NotBlank(message = "请输入模板名称") @Size(max = 100, message = "模板名称最多 100 个字符") String title,
        @NotBlank(message = "请输入模板分类") @Size(max = 64, message = "模板分类最多 64 个字符") String category,
        @Size(max = 1000, message = "模板描述最多 1000 个字符") String description,
        @Size(max = 50, message = "模板字段最多 50 个") List<@Valid PromptTemplateFieldResponse> fieldSchema,
        @Size(max = 20, message = "分辨率档位最多 20 个") List<@Valid PromptTemplateResolutionOptionResponse> resolutionOptions,
        @Size(max = 64, message = "预览图片 ID 无效") String previewImageId,
        @NotBlank(message = "请输入模板提示词") @Size(max = 20000, message = "模板提示词最多 20000 个字符") String promptBody,
        @Size(max = 4000, message = "负面约束最多 4000 个字符") String negativePrompt,
        Integer creditCost,
        @Pattern(regexp = "sections", message = "拼接模式无效") String assemblyMode,
        @Pattern(regexp = "draft|published|disabled|archived", message = "模板状态无效") String status,
        Integer sortOrder,
        @Pattern(regexp = "public|private", message = "模板可见性无效") String visibility
    ) {
    }

    public record PreviewTemplateRequest(
        @NotBlank(message = "请输入模板提示词") @Size(max = 20000, message = "模板提示词最多 20000 个字符") String promptBody,
        @Size(max = 50, message = "模板字段最多 50 个") List<@Valid PromptTemplateFieldResponse> fieldSchema,
        TemplateInputs templateInputs,
        @Size(max = 4000, message = "补充要求最多 4000 个字符") String additionalPrompt,
        @Size(max = 4000, message = "负面约束最多 4000 个字符") String negativePrompt
    ) {
    }
}
