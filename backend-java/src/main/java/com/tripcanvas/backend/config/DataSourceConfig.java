package com.tripcanvas.backend.config;

import com.tripcanvas.backend.util.FileStorageUtils;
import java.io.IOException;
import javax.sql.DataSource;
import org.sqlite.SQLiteConfig;
import org.sqlite.SQLiteDataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataSourceConfig {
    @Bean
    public DataSource dataSource(TripCanvasProperties properties) throws IOException {
        FileStorageUtils.ensureRuntimeDirs(properties.dataDir(), properties.uploadDir());
        SQLiteConfig config = new SQLiteConfig();
        config.setJournalMode(SQLiteConfig.JournalMode.WAL);
        config.enforceForeignKeys(true);

        SQLiteDataSource dataSource = new SQLiteDataSource(config);
        String path = properties.dataDir().resolve("app.sqlite").toAbsolutePath().normalize().toString();
        dataSource.setUrl("jdbc:sqlite:" + path);
        return dataSource;
    }
}
