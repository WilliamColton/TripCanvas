package com.tripcanvas.backend.dto.response;

public record ChangelogEntryResponse(
    String id,
    String version,
    String title,
    String content,
    boolean published,
    long createdAt,
    long updatedAt,
    Long publishedAt
) {
}
