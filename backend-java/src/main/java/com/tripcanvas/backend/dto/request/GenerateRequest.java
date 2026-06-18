package com.tripcanvas.backend.dto.request;

import com.tripcanvas.backend.dto.TemplateInputs;
import com.tripcanvas.backend.dto.response.TaskParamsResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record GenerateRequest(
    @NotBlank(message = "缺少 taskId") @Size(max = 64, message = "taskId 无效") String taskId,
    @Size(max = 20000, message = "提示词最多 20000 字") String prompt,
    @Pattern(regexp = "freeform|template", message = "提示词模式无效") String promptMode,
    @Size(max = 64, message = "模板 ID 无效") String templateId,
    @Size(max = 64, message = "模板分辨率档位 ID 无效") String templateResolutionId,
    TemplateInputs templateInputs,
    @Size(max = 4000, message = "补充要求最多 4000 字") String additionalPrompt,
    @Valid TaskParamsResponse params,
    @Size(max = 10, message = "输入图片最多 10 张") List<@NotBlank(message = "输入图片 ID 不能为空") @Size(max = 64, message = "输入图片 ID 无效") String> inputImageIds,
    @Size(max = 64, message = "蒙版图片 ID 无效") String maskImageId,
    Boolean codexCli
) {
}
