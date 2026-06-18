package com.tripcanvas.backend.dto.response;

public record RedemptionCodeResponse(
    String id,
    String code,
    int quota,
    String usedBy,
    Long usedAt,
    long createdAt
) {
}
