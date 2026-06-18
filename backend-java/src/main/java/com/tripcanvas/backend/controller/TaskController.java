package com.tripcanvas.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripcanvas.backend.common.web.ApiResponse;
import com.tripcanvas.backend.dto.request.TaskRequests;
import com.tripcanvas.backend.dto.response.ApiPayloads;
import com.tripcanvas.backend.dto.response.TaskRecordResponse;
import com.tripcanvas.backend.security.AuthContext;
import com.tripcanvas.backend.service.GenerationWorkerService;
import com.tripcanvas.backend.service.TaskService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {
    private final TaskService taskService;
    private final GenerationWorkerService generationWorkerService;
    private final ObjectMapper objectMapper;

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
        return ApiResponse.ok();
    }

    @DeleteMapping
    public ApiResponse<Void> clear(HttpServletRequest request) {
        String userId = AuthContext.requireUserId(request);
        generationWorkerService.cancelUser(userId);
        taskService.clearTasks(userId);
        return ApiResponse.ok();
    }

    @GetMapping(value = "/{id}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public StreamingResponseBody stream(HttpServletRequest request, @PathVariable String id) {
        String userId = AuthContext.requireUserId(request);
        return outputStream -> {
            Instant deadline = Instant.now().plus(Duration.ofMinutes(10));
            String lastStatus = "";
            while (Instant.now().isBefore(deadline)) {
                try {
                    TaskRecordResponse task = taskService.getTask(userId, id);
                    if (!task.status().equals(lastStatus) || "done".equals(task.status()) || "error".equals(task.status())) {
                        writeTask(outputStream, task);
                        lastStatus = task.status();
                        if ("done".equals(task.status()) || "error".equals(task.status())) {
                            return;
                        }
                    }
                    Thread.sleep(1000);
                } catch (Exception e) {
                    return;
                }
            }
        };
    }

    private void writeTask(java.io.OutputStream outputStream, TaskRecordResponse task) throws IOException {
        outputStream.write(("event: task-update\ndata: " + objectMapper.writeValueAsString(task) + "\n\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
        outputStream.flush();
    }
}
