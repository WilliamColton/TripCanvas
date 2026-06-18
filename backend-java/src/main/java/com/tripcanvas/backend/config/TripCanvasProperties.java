package com.tripcanvas.backend.config;

import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "tripcanvas")
public record TripCanvasProperties(
    Path rootDir,
    Path dataDir,
    Path uploadDir,
    Path configFile,
    ThreadPools threadPools
) {
    private static final ThreadPools DEFAULT_THREAD_POOLS = new ThreadPools(
        new ThreadPool(4, 4, 200, 60),
        new ThreadPool(20, 20, 200, 60)
    );

    @Override
    public ThreadPools threadPools() {
        return threadPools == null ? DEFAULT_THREAD_POOLS : threadPools.withDefaults(DEFAULT_THREAD_POOLS);
    }

    public record ThreadPools(
        ThreadPool generationTasks,
        ThreadPool imageRequests
    ) {
        private ThreadPools withDefaults(ThreadPools defaults) {
            return new ThreadPools(
                generationTasks == null ? defaults.generationTasks() : generationTasks.withDefaults(defaults.generationTasks()),
                imageRequests == null ? defaults.imageRequests() : imageRequests.withDefaults(defaults.imageRequests())
            );
        }
    }

    public record ThreadPool(
        Integer coreSize,
        Integer maxSize,
        Integer queueCapacity,
        Integer keepAliveSeconds
    ) {
        private ThreadPool withDefaults(ThreadPool defaults) {
            return new ThreadPool(
                coreSize == null ? defaults.coreSize() : coreSize,
                maxSize == null ? defaults.maxSize() : maxSize,
                queueCapacity == null ? defaults.queueCapacity() : queueCapacity,
                keepAliveSeconds == null ? defaults.keepAliveSeconds() : keepAliveSeconds
            );
        }
    }
}
