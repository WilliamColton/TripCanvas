package com.tripcanvas.backend.dto.request;

public final class TaskRequests {
    private TaskRequests() {
    }

    public record UpdateTaskRequest(Boolean isFavorite) {
    }
}
