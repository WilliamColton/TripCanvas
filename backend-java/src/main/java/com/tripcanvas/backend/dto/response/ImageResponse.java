package com.tripcanvas.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record ImageResponse(
    String id,
    String userId,
    String filePath,
    String mime,
    long size,
    String sha256,
    String source,
    long createdAt
) {
}
