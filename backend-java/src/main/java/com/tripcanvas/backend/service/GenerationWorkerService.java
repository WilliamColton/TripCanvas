package com.tripcanvas.backend.service;

import com.tripcanvas.backend.dto.response.TaskRecordResponse;

public interface GenerationWorkerService {
    void enqueue(String userId, String userLabel, TaskRecordResponse task);

    boolean cancel(String userId, String taskId);

    void cancelUser(String userId);
}
