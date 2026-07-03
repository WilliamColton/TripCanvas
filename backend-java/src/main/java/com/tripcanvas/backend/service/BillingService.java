package com.tripcanvas.backend.service;

import com.tripcanvas.backend.dto.response.TaskRecordResponse;
import java.util.List;

public interface BillingService {
    void recordBillingForSuccessfulImages(BillingBatchInput input);

    void finalizeSuccessfulTask(String userId, TaskRecordResponse task, BillingBatchInput billingInput, int creditCost);

    record BillingImageInput(
        String outputImageId,
        String endpointBaseUrlSnapshot,
        String imageSize,
        long unitCostX10000,
        long unitSaleX10000
    ) {
    }

    record BillingBatchInput(
        String taskId,
        String userId,
        String userLabelSnapshot,
        String imageSize,
        List<BillingImageInput> images,
        long createdAt
    ) {
    }
}
