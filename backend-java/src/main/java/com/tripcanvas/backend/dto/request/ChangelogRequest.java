package com.tripcanvas.backend.dto.request;

import jakarta.validation.constraints.Size;

public record ChangelogRequest(
    @Size(max = 64, message = "版本号最多 64 字") String version,
    @Size(max = 100, message = "标题最多 100 字") String title,
    @Size(max = 20000, message = "更新日志内容最多 20000 字") String content,
    Boolean published
) {
}
