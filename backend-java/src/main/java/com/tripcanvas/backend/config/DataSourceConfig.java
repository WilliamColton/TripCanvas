package com.tripcanvas.backend.config;

/**
 * 数据源由 Spring Boot 依据 application.yml 的 spring.datasource.* 自动配置
 * （HikariCP 连接池 + MySQL 驱动），此处不再手动构造。
 *
 * <p>运行时目录（data/upload）的初始化由 {@link RuntimeDirectoryInitializer} 负责。</p>
 */
public final class DataSourceConfig {
    private DataSourceConfig() {
    }
}