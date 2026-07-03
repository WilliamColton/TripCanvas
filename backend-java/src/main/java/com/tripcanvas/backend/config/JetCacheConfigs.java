package com.tripcanvas.backend.config;

import com.alicp.jetcache.anno.CacheType;
import com.alicp.jetcache.template.QuickConfig;
import com.tripcanvas.backend.cache.CacheNames;
import java.time.Duration;
import java.util.function.Function;

/**
 * JetCache 编程式建缓存工具。
 *
 * <p>{@link com.alicp.jetcache.CacheManager}（{@link com.alicp.jetcache.SimpleCacheManager}）由
 * {@code jetcache-autoconfigure} 自动配置注册，无需 @Enable* 注解；各 service 注入 CacheManager 后
 * 调用 {@link com.alicp.jetcache.CacheManager#getOrCreateCache(QuickConfig)} 创建本地缓存。</p>
 *
 * <p>第一阶段只使用 {@link CacheType#LOCAL}（Caffeine），不依赖 Redis。
 * keyConvertor 用 {@link Function#identity()}：本地缓存 key 即原始 String key，无需序列化。</p>
 */
public final class JetCacheConfigs {
    private JetCacheConfigs() {
    }

    public static QuickConfig local(String name, int localLimit) {
        return QuickConfig.newBuilder(name)
            .cacheType(CacheType.LOCAL)
            .localLimit(localLimit)
            .expire(Duration.ofSeconds(CacheNames.LOCAL_TTL_SECONDS))
            .keyConvertor(Function.identity())
            .build();
    }
}