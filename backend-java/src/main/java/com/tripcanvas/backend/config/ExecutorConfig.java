package com.tripcanvas.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class ExecutorConfig {
    public static final String GENERATION_TASK_EXECUTOR = "generationTaskExecutor";
    public static final String IMAGE_REQUEST_EXECUTOR = "imageRequestExecutor";

    @Bean(name = GENERATION_TASK_EXECUTOR)
    public ThreadPoolTaskExecutor generationTaskExecutor(TripCanvasProperties properties) {
        return executor("generation-task-", properties.threadPools().generationTasks());
    }

    @Bean(name = IMAGE_REQUEST_EXECUTOR)
    public ThreadPoolTaskExecutor imageRequestExecutor(TripCanvasProperties properties) {
        return executor("image-request-", properties.threadPools().imageRequests());
    }

    private ThreadPoolTaskExecutor executor(String threadNamePrefix, TripCanvasProperties.ThreadPool properties) {
        int coreSize = positive(properties.coreSize(), "core-size");
        int maxSize = positive(properties.maxSize(), "max-size");
        int queueCapacity = nonNegative(properties.queueCapacity(), "queue-capacity");
        int keepAliveSeconds = nonNegative(properties.keepAliveSeconds(), "keep-alive-seconds");
        if (maxSize < coreSize) {
            throw new IllegalArgumentException("thread pool max-size must be greater than or equal to core-size");
        }

        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setThreadNamePrefix(threadNamePrefix);
        executor.setCorePoolSize(coreSize);
        executor.setMaxPoolSize(maxSize);
        executor.setQueueCapacity(queueCapacity);
        executor.setKeepAliveSeconds(keepAliveSeconds);
        executor.setAllowCoreThreadTimeOut(keepAliveSeconds > 0);
        executor.setWaitForTasksToCompleteOnShutdown(false);
        executor.setAwaitTerminationSeconds(10);
        return executor;
    }

    private int positive(Integer value, String name) {
        if (value == null || value < 1) {
            throw new IllegalArgumentException("thread pool " + name + " must be at least 1");
        }
        return value;
    }

    private int nonNegative(Integer value, String name) {
        if (value == null || value < 0) {
            throw new IllegalArgumentException("thread pool " + name + " must be at least 0");
        }
        return value;
    }
}
