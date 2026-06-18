package com.tripcanvas.backend.service;

import com.tripcanvas.backend.dto.response.FeedbackResponse;
import java.util.List;

public interface FeedbackService {
    FeedbackResponse create(String userId, String userLabel, String category, String content, String contact);

    List<FeedbackResponse> list(String status);

    FeedbackResponse updateStatus(String id, String status);
}
