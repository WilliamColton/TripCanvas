package com.tripcanvas.backend.dto.request;

import jakarta.validation.constraints.Size;

public record AnnouncementRequest(@Size(max = 2000, message = "公告最多 2000 个字符") String content, Boolean enabled) {
}
