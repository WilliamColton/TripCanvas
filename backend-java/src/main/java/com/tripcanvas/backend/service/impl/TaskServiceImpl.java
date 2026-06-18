package com.tripcanvas.backend.service.impl;

import com.mybatisflex.core.query.QueryWrapper;
import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.dto.response.TaskParamsResponse;
import com.tripcanvas.backend.dto.response.TaskRecordResponse;
import com.tripcanvas.backend.entity.TaskEntity;
import com.tripcanvas.backend.entity.UserEntity;
import com.tripcanvas.backend.mapper.TaskMapper;
import com.tripcanvas.backend.mapper.UserMapper;
import com.tripcanvas.backend.service.TaskService;
import com.tripcanvas.backend.structmapper.TaskDtoMapper;
import com.tripcanvas.backend.util.FlexQuery;
import com.tripcanvas.backend.util.JsonUtils;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TaskServiceImpl implements TaskService {
    private final TaskMapper taskMapper;
    private final UserMapper userMapper;
    private final TaskDtoMapper taskDtoMapper;

    @Override
    public List<TaskRecordResponse> listTasks(String userId) {
        QueryWrapper query = FlexQuery.orderBy(FlexQuery.eq("user_id", userId), "created_at DESC");
        return taskMapper.selectListByQuery(query).stream().map(this::toResponse).toList();
    }

    @Override
    public TaskRecordResponse getTask(String userId, String taskId) {
        TaskEntity task = selectTask(userId, taskId);
        return toResponse(task);
    }

    @Override
    public void upsertTask(String userId, TaskRecordResponse task) {
        TaskEntity entity = toEntity(userId, task);
        if (taskMapper.selectOneById(task.id()) == null) {
            taskMapper.insert(entity);
        } else {
            taskMapper.update(entity);
        }
    }

    @Override
    @Transactional
    public QuotaCheckResult checkQuotaAndCreateTask(String userId, TaskRecordResponse task, int n) {
        int normalizedN = TaskService.normalizeTaskN(n);
        UserEntity user = userMapper.selectOneById(userId);
        if (user == null) {
            return new QuotaCheckResult(false, "用户不存在", null);
        }
        if (taskMapper.selectOneById(task.id()) != null) {
            throw ApiException.conflict("任务 ID 已存在");
        }
        if ((user.getUnlimitedQuota() == null || user.getUnlimitedQuota() == 0)) {
            int pending = countPendingImages(userId);
            int used = user.getUsedCount() == null ? 0 : user.getUsedCount();
            int quota = user.getQuota() == null ? 0 : user.getQuota();
            if (used + pending + normalizedN > quota) {
                int remaining = Math.max(0, quota - used - pending);
                return new QuotaCheckResult(false, "配额不足，剩余 %d 张（含进行中任务），本次需要 %d 张".formatted(remaining, normalizedN), null);
            }
        }
        taskMapper.insert(toEntity(userId, task));
        return new QuotaCheckResult(true, "", task);
    }

    @Override
    public void updateFavorite(String userId, String taskId, boolean favorite) {
        TaskEntity task = selectTask(userId, taskId);
        task.setIsFavorite(favorite ? 1 : 0);
        taskMapper.update(task);
    }

    @Override
    public void deleteTask(String userId, String taskId) {
        if (selectTask(userId, taskId) == null) {
            throw ApiException.notFound("任务不存在");
        }
        taskMapper.deleteByQuery(FlexQuery.and(FlexQuery.eq("id", taskId), "user_id = ?", userId));
    }

    @Override
    public void clearTasks(String userId) {
        taskMapper.deleteByQuery(FlexQuery.eq("user_id", userId));
    }

    @Override
    public int countPendingImages(String userId) {
        List<TaskEntity> tasks = taskMapper.selectListByQuery(
            FlexQuery.and(FlexQuery.eq("user_id", userId), "status IN ('queued','running')")
        );
        int total = 0;
        for (TaskEntity task : tasks) {
            TaskParamsResponse params = JsonUtils.parseTaskParams(task.getParamsJson());
            total += TaskService.normalizeTaskN(params == null ? null : params.n());
        }
        return total;
    }

    private TaskEntity selectTask(String userId, String taskId) {
        TaskEntity task = taskMapper.selectOneByQuery(FlexQuery.and(FlexQuery.eq("id", taskId), "user_id = ?", userId));
        if (task == null) {
            throw ApiException.notFound("任务不存在");
        }
        return task;
    }

    private TaskEntity toEntity(String userId, TaskRecordResponse task) {
        return taskDtoMapper.toEntity(userId, task);
    }

    private TaskRecordResponse toResponse(TaskEntity task) {
        return taskDtoMapper.toResponse(task);
    }
}
