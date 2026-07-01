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
    long createdAt,
    /** 对外访问直链：COS 预签名/公开 URL；本地模式留空，前端走 /api/images/{id}。 */
    String url
) {
}
