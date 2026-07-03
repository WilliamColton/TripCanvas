package com.tripcanvas.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record AuthUserResponse(
    String id,
    String username,
    String label,
    String role,
    int imageCount,
    int quota,
    boolean unlimitedQuota,
    int usedCount,
    Boolean needsMigration,
    String email,
    Boolean emailVerified
) {
}
