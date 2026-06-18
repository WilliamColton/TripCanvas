package com.tripcanvas.backend.service.impl;

import com.tripcanvas.backend.dto.response.TaskRecordResponse;
import com.tripcanvas.backend.entity.BillingRecordEntity;
import com.tripcanvas.backend.entity.TaskEntity;
import com.tripcanvas.backend.entity.UserEntity;
import com.tripcanvas.backend.mapper.BillingRecordMapper;
import com.tripcanvas.backend.mapper.TaskMapper;
import com.tripcanvas.backend.mapper.UserMapper;
import com.tripcanvas.backend.service.BillingService;
import com.tripcanvas.backend.structmapper.TaskDtoMapper;
import com.tripcanvas.backend.util.Ids;
import com.tripcanvas.backend.util.Times;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BillingServiceImpl implements BillingService {
    private final BillingRecordMapper billingRecordMapper;
    private final UserMapper userMapper;
    private final TaskMapper taskMapper;
    private final TaskDtoMapper taskDtoMapper;

    @Override
    @Transactional
    public void recordBillingForSuccessfulImages(BillingBatchInput input) {
        insertBillingRows(input);
    }

    @Override
    @Transactional
    public void finalizeSuccessfulTask(String userId, TaskRecordResponse task, BillingBatchInput billingInput, int outputCount) {
        insertBillingRows(billingInput);
        if (outputCount > 0) {
            UserEntity user = userMapper.selectOneById(userId);
            if (user != null) {
                int used = user.getUsedCount() == null ? 0 : user.getUsedCount();
                user.setUsedCount(used + outputCount);
                userMapper.update(user);
            }
        }
        TaskEntity entity = taskDtoMapper.toEntity(userId, task);
        if (taskMapper.selectOneById(task.id()) == null) {
            taskMapper.insert(entity);
        } else {
            taskMapper.update(entity);
        }
    }

    private void insertBillingRows(BillingBatchInput input) {
        if (input == null || input.images() == null || input.images().isEmpty()) {
            return;
        }
        long now = input.createdAt() == 0 ? Times.nowMillis() : input.createdAt();
        List<BillingRecordEntity> records = input.images().stream()
            .map(image -> toRecord(input, image, now))
            .toList();
        for (BillingRecordEntity record : records) {
            billingRecordMapper.insert(record);
        }
    }

    private BillingRecordEntity toRecord(BillingBatchInput batch, BillingImageInput image, long createdAt) {
        String imageSize = image.imageSize() == null || image.imageSize().isBlank() ? batch.imageSize() : image.imageSize();
        long cost = image.unitCostX10000();
        long revenue = image.unitSaleX10000();
        return new BillingRecordEntity()
            .setId(Ids.generate())
            .setTaskId(batch.taskId())
            .setUserId(batch.userId())
            .setUserLabelSnapshot(batch.userLabelSnapshot())
            .setEndpointBaseUrlSnapshot(image.endpointBaseUrlSnapshot())
            .setImageSize(imageSize)
            .setOutputImageId(image.outputImageId())
            .setSuccessImageCount(1)
            .setUnitCostX10000(cost)
            .setUnitSaleX10000(revenue)
            .setCostX10000(cost)
            .setRevenueX10000(revenue)
            .setProfitX10000(revenue - cost)
            .setCreatedAt(createdAt);
    }
}
