package com.tripcanvas.backend.service;

import com.tripcanvas.backend.dto.request.GenerateRequest;
import com.tripcanvas.backend.dto.response.AuthUserResponse;

public interface GenerationService {
    SubmitResult submit(AuthUserResponse user, GenerateRequest request, boolean edit);

    record SubmitResult(String taskId, String status) {
    }
}