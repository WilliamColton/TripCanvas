package com.tripcanvas.backend.service.impl;

import com.tripcanvas.backend.dto.response.ApiEndpointResponse;
import com.tripcanvas.backend.service.EndpointLimiterService;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class EndpointLimiterServiceImpl implements EndpointLimiterService {
    private final Map<String, EndpointLimiter> limiters = new ConcurrentHashMap<>();
    private final Object slotMonitor = new Object();

    @Override
    public Lease acquire(List<ApiEndpointResponse> endpoints, int startIndex, Runnable onAcquired) throws InterruptedException {
        boolean acquiredCallback = false;
        while (true) {
            for (int i = Math.max(0, startIndex); i < endpoints.size(); i++) {
                Lease lease = tryAcquire(endpoints.get(i), i);
                if (lease != null) {
                    if (!acquiredCallback && onAcquired != null) {
                        acquiredCallback = true;
                        onAcquired.run();
                    }
                    return lease;
                }
            }
            log.debug("所有端点已满，等待槽位释放");
            synchronized (slotMonitor) {
                slotMonitor.wait(Duration.ofSeconds(1).toMillis());
            }
        }
    }

    private Lease tryAcquire(ApiEndpointResponse endpoint, int index) {
        int maxConcurrency = endpoint.maxConcurrency() == null ? 0 : endpoint.maxConcurrency();
        if (maxConcurrency <= 0) {
            return new SimpleLease(index, () -> {});
        }
        EndpointLimiter limiter = limiters.computeIfAbsent(limiterKey(endpoint), key -> new EndpointLimiter(maxConcurrency));
        limiter.setLimit(maxConcurrency);
        Runnable release = limiter.tryAcquire();
        return release == null ? null : new SimpleLease(index, release);
    }

    private String limiterKey(ApiEndpointResponse endpoint) {
        return Objects.toString(endpoint.runtimePool(), "") + "|" + Objects.toString(endpoint.baseUrl(), "");
    }

    private void notifySlotAvailable() {
        synchronized (slotMonitor) {
            slotMonitor.notifyAll();
        }
    }

    private final class EndpointLimiter {
        private int limit;
        private int inFlight;

        private EndpointLimiter(int limit) {
            this.limit = limit;
        }

        private synchronized void setLimit(int limit) {
            this.limit = limit;
            notifySlotAvailable();
        }

        private synchronized Runnable tryAcquire() {
            if (limit <= 0 || inFlight >= limit) {
                return null;
            }
            inFlight++;
            return new Runnable() {
                private boolean released;

                @Override
                public void run() {
                    synchronized (EndpointLimiter.this) {
                        if (released) {
                            return;
                        }
                        released = true;
                        if (inFlight > 0) {
                            inFlight--;
                        }
                    }
                    notifySlotAvailable();
                }
            };
        }
    }

    private record SimpleLease(int endpointIndex, Runnable release) implements Lease {
        @Override
        public void close() {
            release.run();
        }
    }
}
