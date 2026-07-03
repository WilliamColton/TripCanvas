package com.tripcanvas.backend.storage;

import com.tripcanvas.backend.config.TripCanvasProperties;
import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.util.FileStorageUtils;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * 本地文件系统实现。沿用 TripCanvas 原 ./upload 目录结构与 FileStorageUtils 工具。
 * 不提供直链，URL 交给控制器以 /api/images/{id} 形式服务。
 */
@Service
@ConditionalOnProperty(prefix = "tripcanvas.storage", name = "type", havingValue = "local", matchIfMissing = true)
public class LocalImageStorageService implements ImageStorageService {

    private final TripCanvasProperties properties;

    public LocalImageStorageService(TripCanvasProperties properties) {
        this.properties = properties;
    }

    @Override
    public String type() {
        return "local";
    }

    @Override
    public StoredObject save(String key, byte[] bytes, String mime) {
        try {
            Path absPath = resolveAbsPath(key);
            Files.createDirectories(absPath.getParent());
            Files.write(absPath, bytes);
        } catch (IOException e) {
            throw ApiException.internal("图片保存失败");
        }
        // 本地模式无直链，url 留空，由控制器兜底。
        return new StoredObject(key, null);
    }

    @Override
    public byte[] readBytes(String key) {
        try {
            return Files.readAllBytes(resolveAbsPath(key));
        } catch (IOException e) {
            throw ApiException.notFound("图片不存在");
        }
    }

    @Override
    public String accessUrl(String key) {
        return null;
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolveAbsPath(key));
        } catch (IOException ignored) {
        }
    }

    @Override
    public String presignPut(String key, String mime, long size) {
        // 本地模式不支持浏览器直传，返回 null 让前端回退 multipart 上传。
        return null;
    }

    private Path resolveAbsPath(String key) throws IOException {
        return FileStorageUtils.resolveUploadPath(properties.uploadDir(), key);
    }
}