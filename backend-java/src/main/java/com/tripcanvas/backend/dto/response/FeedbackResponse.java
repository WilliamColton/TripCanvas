package com.tripcanvas.backend.dto.response;

public record FeedbackResponse(
    String id,
    String userId,
    String userLabel,
    String category,
    String content,
    String contact,
    String status,
    long createdAt,
    long updatedAt
) {
}
