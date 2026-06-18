package com.tripcanvas.backend.config;

import com.tripcanvas.backend.util.FileStorageUtils;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RuntimeDirectoryInitializer {
    private final TripCanvasProperties properties;

    @PostConstruct
    public void init() throws IOException {
        FileStorageUtils.ensureRuntimeDirs(properties.dataDir(), properties.uploadDir());
    }
}
