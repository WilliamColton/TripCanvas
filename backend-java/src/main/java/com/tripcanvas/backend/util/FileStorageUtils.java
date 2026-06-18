package com.tripcanvas.backend.util;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public final class FileStorageUtils {
    private FileStorageUtils() {
    }

    public static void ensureRuntimeDirs(Path dataDir, Path uploadDir) throws IOException {
        Files.createDirectories(dataDir);
        Files.createDirectories(uploadDir);
    }

    public static Path ensureUserUploadDir(Path uploadDir, String userId) throws IOException {
        Path dir = uploadDir.resolve(userId).normalize();
        Files.createDirectories(dir);
        return dir;
    }

    public static String toUploadRelativePath(Path uploadDir, Path filePath) {
        return uploadDir.toAbsolutePath().normalize().relativize(filePath.toAbsolutePath().normalize()).toString().replace('\\', '/');
    }

    public static Path resolveUploadPath(Path uploadDir, String relativePath) throws IOException {
        Path root = uploadDir.toAbsolutePath().normalize();
        Path resolved = root.resolve(relativePath).normalize();
        if (!resolved.startsWith(root)) {
            throw new IOException("invalid upload path");
        }
        return resolved;
    }
}
