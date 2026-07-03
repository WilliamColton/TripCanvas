package com.tripcanvas.backend.service;

import com.tripcanvas.backend.dto.response.TaskRecordResponse;
import java.util.List;

public interface TaskService {
    int MAX_TASK_N = 10;

    List<TaskRecordResponse> listTasks(String userId);

    TaskRecordResponse getTask(String userId, String taskId);

    void upsertTask(String userId, TaskRecordResponse task);

    QuotaCheckResult checkQuotaAndCreateTask(String userId, TaskRecordResponse task, int creditCost);

    void updateFavorite(String userId, String taskId, boolean favorite);

    void deleteTask(String userId, String taskId);

    void clearTasks(String userId);

    int countPendingCredits(String userId);

    static int normalizeTaskN(Integer n) {
        if (n == null || n < 1) {
            return 1;
        }
        if (n > MAX_TASK_N) {
            return MAX_TASK_N;
        }
        return n;
    }

    record QuotaCheckResult(boolean allowed, String error, TaskRecordResponse task) {
    }
}
