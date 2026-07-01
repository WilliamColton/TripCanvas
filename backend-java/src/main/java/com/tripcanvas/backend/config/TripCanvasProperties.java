package com.tripcanvas.backend.config;

import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "tripcanvas")
public record TripCanvasProperties(
    Path rootDir,
    Path dataDir,
    Path uploadDir,
    Path configFile,
    ThreadPools threadPools,
    Storage storage
) {
    private static final ThreadPools DEFAULT_THREAD_POOLS = new ThreadPools(
        new ThreadPool(4, 4, 200, 60),
        new ThreadPool(20, 20, 200, 60)
    );

    @Override
    public ThreadPools threadPools() {
        return threadPools == null ? DEFAULT_THREAD_POOLS : threadPools.withDefaults(DEFAULT_THREAD_POOLS);
    }

    public Storage storage() {
        return storage == null ? Storage.defaultLocal() : storage;
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

    /**
     * 图片存储配置。
     * type=local 走本地文件系统（兼容原有 ./upload 目录）；type=cos 走腾讯云 COS。
     */
    public record Storage(
        String type,
        String secretId,
        String secretKey,
        String region,
        String bucket,
        String keyPrefix,
        Long signedUrlTtlSeconds,
        String publicBaseUrl
    ) {
        public static Storage defaultLocal() {
            return new Storage("local", null, null, null, null, "images/", 900L, null);
        }

        public String type() {
            return type == null || type.isBlank() ? "local" : type.toLowerCase();
        }

        public boolean isCos() {
            return "cos".equals(type());
        }

        public Long signedUrlTtlSeconds() {
            return signedUrlTtlSeconds == null || signedUrlTtlSeconds <= 0 ? 900L : signedUrlTtlSeconds;
        }

        public String keyPrefix() {
            return keyPrefix == null || keyPrefix.isBlank() ? "images/" : keyPrefix;
        }
    }
}
