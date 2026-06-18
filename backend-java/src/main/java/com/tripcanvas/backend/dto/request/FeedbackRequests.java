package com.tripcanvas.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class FeedbackRequests {
    private FeedbackRequests() {
    }

    public record CreateFeedbackRequest(
        @NotBlank(message = "反馈分类不能为空") @Pattern(regexp = "bug|feature", message = "反馈分类无效") String category,
        @NotBlank(message = "请填写问题描述") @Size(max = 2000, message = "问题描述最多 2000 字") String content,
        @Size(max = 200, message = "联系方式最多 200 字") String contact
    ) {
    }

    public record UpdateFeedbackStatusRequest(@NotBlank(message = "反馈状态不能为空") @Pattern(regexp = "open|reviewing|resolved", message = "反馈状态无效") String status) {
    }
}
