package com.tripcanvas.backend.controller;

import com.tripcanvas.backend.dto.request.FeedbackRequests;
import com.tripcanvas.backend.dto.response.ApiPayloads;
import com.tripcanvas.backend.dto.response.FeedbackResponse;
import com.tripcanvas.backend.security.AuthContext;
import com.tripcanvas.backend.service.FeedbackService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class FeedbackController {
    private final FeedbackService feedbackService;

    @PostMapping("/api/feedback")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiPayloads.Feedback create(HttpServletRequest request, @Valid @RequestBody FeedbackRequests.CreateFeedbackRequest body) {
        var user = AuthContext.requireUser(request);
        return new ApiPayloads.Feedback(feedbackService.create(user.id(), user.label(), body.category(), body.content(), body.contact()));
    }

    @GetMapping("/api/admin/feedback")
    public ApiPayloads.Feedbacks list(@RequestParam(value = "status", required = false) String status) {
        return new ApiPayloads.Feedbacks(feedbackService.list(status));
    }

    @PutMapping("/api/admin/feedback/{id}/status")
    public FeedbackResponse updateStatus(@org.springframework.web.bind.annotation.PathVariable String id, @Valid @RequestBody FeedbackRequests.UpdateFeedbackStatusRequest body) {
        return feedbackService.updateStatus(id, body.status());
    }
}
