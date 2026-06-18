package com.tripcanvas.backend.service;

import com.tripcanvas.backend.dto.request.GenerateRequest;

public interface GenerationService {
    SubmitResult submit(String userId, GenerateRequest request, boolean edit);

    record SubmitResult(String taskId, String status) {
    }
}
