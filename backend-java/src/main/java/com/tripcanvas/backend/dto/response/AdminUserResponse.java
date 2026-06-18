package com.tripcanvas.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record AdminUserResponse(
    String id,
    String label,
    String username,
    String role,
    String status,
    int quota,
    boolean unlimitedQuota,
    int usedCount,
    long createdAt
) {
}
