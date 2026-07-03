package com.tripcanvas.backend.controller;

import com.tripcanvas.backend.common.web.ApiResponse;
import com.tripcanvas.backend.dto.request.TaskRequests;
import com.tripcanvas.backend.dto.response.ApiPayloads;
import com.tripcanvas.backend.dto.response.TaskRecordResponse;
import com.tripcanvas.backend.security.AuthContext;
import com.tripcanvas.backend.service.GenerationWorkerService;
import com.tripcanvas.backend.service.TaskProgressBroadcaster;
import com.tripcanvas.backend.service.TaskService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {
    private final TaskService taskService;
    private final GenerationWorkerService generationWorkerService;
    private final TaskProgressBroadcaster broadcaster;

    @GetMapping
    public ApiPayloads.Tasks list(HttpServletRequest request) {
        return new ApiPayloads.Tasks(taskService.listTasks(AuthContext.requireUserId(request)));
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(HttpServletRequest request, @PathVariable String id, @Valid @RequestBody TaskRequests.UpdateTaskRequest body) {
        if (body.isFavorite() != null) {
            taskService.updateFavorite(AuthContext.requireUserId(request), id, body.isFavorite());
        }
        return ApiResponse.ok();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(HttpServletRequest request, @PathVariable String id) {
        String userId = AuthContext.requireUserId(request);
        generationWorkerService.cancel(userId, id);
        taskService.deleteTask(userId, id);
        broadcaster.complete(id);
        return ApiResponse.ok();
    }

    @DeleteMapping
    public ApiResponse<Void> clear(HttpServletRequest request) {
        String userId = AuthContext.requireUserId(request);
        generationWorkerService.cancelUser(userId);
        List<TaskRecordResponse> tasks = taskService.listTasks(userId);
        taskService.clearTasks(userId);
        for (TaskRecordResponse task : tasks) {
            broadcaster.complete(task.id());
        }
        return ApiResponse.ok();
    }

    /**
     * 任务进度 SSE。先 subscribe（让 worker 期间的 publish 进 earlyEvents 不丢），再 getTask 发首帧，
     * 终态则立即 complete；不再每秒轮询 DB。event 名与 data 格式与原 StreamingResponseBody 方案一致，前端无需改。
     */
    @GetMapping(value = "/{id}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(HttpServletRequest request, @PathVariable String id) {
        String userId = AuthContext.requireUserId(request);
        SseEmitter emitter = broadcaster.subscribe(id);
        try {
            TaskRecordResponse current = taskService.getTask(userId, id);
            emitter.send(SseEmitter.event()
                .name("task-update")
                .data(current, MediaType.APPLICATION_JSON));
            if ("done".equals(current.status()) || "error".equals(current.status())) {
                emitter.complete();
            }
        } catch (RuntimeException e) {
            broadcaster.unsubscribe(id, emitter);
            throw e;
        } catch (Exception e) {
            broadcaster.unsubscribe(id, emitter);
            throw new IllegalStateException("无法初始化任务进度流", e);
        }
        return emitter;
    }
}
