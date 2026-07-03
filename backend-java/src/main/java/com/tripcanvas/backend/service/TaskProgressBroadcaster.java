package com.tripcanvas.backend.service;

import com.tripcanvas.backend.dto.response.TaskRecordResponse;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 任务进度 SSE 推送注册表（进程内、单实例）。
 *
 * <p>worker 在任务状态持久化后调 {@link #publish} 把新 {@link TaskRecordResponse} 推给订阅了该 taskId 的
 * {@link SseEmitter}；{@link TaskController#stream} 调 {@link #subscribe} 注册 emitter。
 * 取代了原先每秒轮询 {@code getTask} 的 {@link org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody} 方案。
 *
 * <p>心跳：每 {@value #HEARTBEAT_INTERVAL_SECONDS}s 向所有 emitter 发一个 SSE 注释帧（{@code :keep-alive}），
 * 防止 nginx/CDN 因空闲超时断连；客户端 EventSource 忽略注释行，不影响业务事件。
 * 实测 14s 空闲会断连，9s 心跳留 5s 余量。
 *
 * <p>多实例部署下 worker 与 SSE 客户端可能不在同一 JVM，进程内注册表推不到，需换成 Redis pub/sub（本项目当前无 Redis）。
 */
@Component
@Slf4j
public class TaskProgressBroadcaster {
    private static final long SSE_TIMEOUT_MS = 10 * 60 * 1000L;
    private static final String EVENT_NAME = "task-update";
    private static final long HEARTBEAT_INTERVAL_SECONDS = 9L;
    private static final String HEARTBEAT_COMMENT = "keep-alive";

    private final ConcurrentHashMap<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();
    private final ScheduledExecutorService heartbeatExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "sse-heartbeat");
        t.setDaemon(true);
        return t;
    });

    @PostConstruct
    void startHeartbeat() {
        heartbeatExecutor.scheduleAtFixedRate(
            this::sendHeartbeats,
            HEARTBEAT_INTERVAL_SECONDS,
            HEARTBEAT_INTERVAL_SECONDS,
            TimeUnit.SECONDS
        );
    }

    @PreDestroy
    void shutdown() {
        heartbeatExecutor.shutdownNow();
        for (List<SseEmitter> list : emitters.values()) {
            for (SseEmitter emitter : list) {
                try {
                    emitter.complete();
                } catch (Exception ignored) {
                    // 忽略：emitter 可能已关闭
                }
            }
        }
        emitters.clear();
    }

    public SseEmitter subscribe(String taskId) {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        emitters.computeIfAbsent(taskId, k -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> remove(taskId, emitter));
        emitter.onTimeout(() -> remove(taskId, emitter));
        emitter.onError(e -> remove(taskId, emitter));
        return emitter;
    }

    public void publish(String taskId, TaskRecordResponse task) {
        List<SseEmitter> list = emitters.get(taskId);
        if (list == null || list.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event()
                    .name(EVENT_NAME)
                    .data(task, MediaType.APPLICATION_JSON));
            } catch (Exception e) {
                log.debug("SSE send 失败，移除 emitter taskId={}", taskId, e);
                remove(taskId, emitter);
            }
        }
    }

    public void unsubscribe(String taskId, SseEmitter emitter) {
        remove(taskId, emitter);
    }

    public void complete(String taskId) {
        List<SseEmitter> list = emitters.remove(taskId);
        if (list == null) {
            return;
        }
        for (SseEmitter emitter : list) {
            try {
                emitter.complete();
            } catch (Exception ignored) {
                // 忽略：emitter 可能已关闭
            }
        }
    }

    private void sendHeartbeats() {
        for (Map.Entry<String, List<SseEmitter>> entry : emitters.entrySet()) {
            String taskId = entry.getKey();
            for (SseEmitter emitter : entry.getValue()) {
                try {
                    emitter.send(SseEmitter.event().comment(HEARTBEAT_COMMENT));
                } catch (Exception e) {
                    remove(taskId, emitter);
                }
            }
        }
    }

    private void remove(String taskId, SseEmitter emitter) {
        List<SseEmitter> list = emitters.get(taskId);
        if (list != null) {
            list.remove(emitter);
        }
    }
}