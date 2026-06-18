package com.tripcanvas.backend.service;

import com.tripcanvas.backend.dto.response.ApiEndpointResponse;
import java.util.List;

public interface EndpointLimiterService {
    Lease acquire(List<ApiEndpointResponse> endpoints, int startIndex, Runnable onAcquired) throws InterruptedException;

    interface Lease extends AutoCloseable {
        int endpointIndex();

        @Override
        void close();
    }
}
