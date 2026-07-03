package com.tripcanvas.backend.cache;

/**
 * JetCache 缓存命名空间、TTL、容量与固定 key 常量集中维护，避免散落硬编码。
 *
 * <p>所有缓存第一阶段都使用 {@link com.alicp.jetcache.anno.CacheType#LOCAL}（Caffeine），TTL 为
 * {@link #LOCAL_TTL_SECONDS} 秒；模板类缓存通过 epoch 前缀做整体失效，详见
 * {@code PromptTemplateServiceImpl}。</p>
 */
public final class CacheNames {

    /** 本地缓存默认写入后过期时间（秒）。 */
    public static final int LOCAL_TTL_SECONDS = 300;

    /** 本地缓存默认每个 cache 实例的最大条目数（Caffeine LRU）。 */
    public static final int LOCAL_LIMIT = 5000;

    /** 单条目缓存的容量。 */
    public static final int SINGLE_ENTRY_LIMIT = 16;

    // cache name（cache 命名空间）
    public static final String PUBLIC_CONFIG = "publicConfig";
    public static final String ANNOUNCEMENT = "announcement";
    public static final String CHANGELOG_LIST = "changelog:list";
    public static final String CHANGELOG_LATEST = "changelog:latest";
    public static final String TEMPLATE_USER_LIST = "template:user:list";
    public static final String TEMPLATE_USER_DETAIL = "template:user:detail";
    public static final String TEMPLATE_ADMIN_LIST = "template:admin:list";
    public static final String AUTH_USER = "authUser";

    // 固定 key
    public static final String KEY_PUBLIC_CONFIG = "v1";
    public static final String KEY_ANNOUNCEMENT = "default";
    public static final String KEY_CHANGELOG_PUBLIC = "false";
    public static final String KEY_CHANGELOG_ADMIN = "true";
    public static final String KEY_CHANGELOG_LATEST = "published";
    public static final String KEY_TEMPLATE_ADMIN_ALL = "all";

    private CacheNames() {
    }
}