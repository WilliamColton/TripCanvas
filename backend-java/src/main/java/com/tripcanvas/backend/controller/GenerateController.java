package com.tripcanvas.backend.controller;

import com.tripcanvas.backend.dto.request.GenerateRequest;
import com.tripcanvas.backend.dto.response.ApiPayloads;
import com.tripcanvas.backend.security.AuthContext;
import com.tripcanvas.backend.service.GenerationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class GenerateController {
    private final GenerationService generationService;

    @PostMapping("/api/generate")
    public ApiPayloads.GenerateSubmit generate(HttpServletRequest request, @Valid @RequestBody GenerateRequest body) {
        GenerationService.SubmitResult result = generationService.submit(AuthContext.requireUser(request), body, false);
        return new ApiPayloads.GenerateSubmit(result.taskId(), result.status());
    }

    @PostMapping("/api/edit")
    public ApiPayloads.GenerateSubmit edit(HttpServletRequest request, @Valid @RequestBody GenerateRequest body) {
        GenerationService.SubmitResult result = generationService.submit(AuthContext.requireUser(request), body, true);
        return new ApiPayloads.GenerateSubmit(result.taskId(), result.status());
    }
}
