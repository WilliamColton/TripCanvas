package com.tripcanvas.backend.service.impl;

import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.config.TripCanvasProperties;
import com.tripcanvas.backend.dto.response.ImageResponse;
import com.tripcanvas.backend.entity.ImageEntity;
import com.tripcanvas.backend.mapper.ImageMapper;
import com.tripcanvas.backend.mapper.PromptTemplateMapper;
import com.tripcanvas.backend.service.ImageService;
import com.tripcanvas.backend.storage.ImageStorageService;
import com.tripcanvas.backend.structmapper.ImageDtoMapper;
import com.tripcanvas.backend.util.CryptoUtils;
import com.tripcanvas.backend.util.FileStorageUtils;
import com.tripcanvas.backend.util.FlexQuery;
import com.tripcanvas.backend.util.Ids;
import com.tripcanvas.backend.util.Times;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ImageServiceImpl implements ImageService {
    private static final Map<String, String> MIME_EXT = Map.of(
        "image/png", "png",
        "image/jpeg", "jpg",
        "image/webp", "webp"
    );

    private final ImageMapper imageMapper;
    private final PromptTemplateMapper templateMapper;
    private final TripCanvasProperties properties;
    private final ImageDtoMapper imageDtoMapper;
    private final ImageStorageService storage;

    @Override
    public ImageResponse saveImageBuffer(String userId, byte[] bytes, String mime, String source) {
        String sha256 = CryptoUtils.sha256Hex(bytes);
        ImageEntity existing = imageMapper.selectOneByQuery(
            FlexQuery.and(FlexQuery.eq("user_id", userId), "sha256 = ?", sha256)
        );
        if (existing != null) {
            return toResponseWithUrl(existing);
        }
        String id = Ids.generate();
        String ext = MIME_EXT.getOrDefault(mime, "png");
        String key = buildKey(userId, id, ext);
        ImageStorageService.StoredObject stored = storage.save(key, bytes, mime);

        long now = Times.nowMillis();
        boolean isCos = storage.type().equals("cos");
        ImageEntity image = new ImageEntity()
            .setId(id)
            .setUserId(userId)
            .setFilePath(stored.key())
            .setMime(mime)
            .setSize((long) bytes.length)
            .setSha256(sha256)
            .setSource(parseSource(source))
            .setCreatedAt(now)
            .setStorageType(storage.type())
            .setStorageKey(stored.key())
            .setPublicUrl(stored.url());
        try {
            imageMapper.insert(image);
        } catch (Exception e) {
            storage.delete(stored.key());
            throw ApiException.internal("图片保存失败");
        }
        return toResponseWithUrl(image);
    }

    @Override
    public ImageFile readImageFileForUser(String userId, String imageId) {
        ImageEntity image = imageMapper.selectOneByQuery(
            FlexQuery.and(FlexQuery.eq("id", imageId), "user_id = ?", userId)
        );
        if (image == null) {
            throw ApiException.notFound("图片不存在");
        }
        return toImageFile(image);
    }

    @Override
    public ImageFile readTemplatePreviewImageFile(String imageId) {
        long count = templateMapper.selectCountByQuery(FlexQuery.eq("preview_image_id", imageId));
        if (count == 0) {
            throw ApiException.notFound("图片不存在");
        }
        ImageEntity image = imageMapper.selectOneById(imageId);
        if (image == null) {
            throw ApiException.notFound("图片不存在");
        }
        return toImageFile(image);
    }

    @Override
    public byte[] readBytesForUser(String userId, String imageId) {
        ImageEntity image = imageMapper.selectOneByQuery(
            FlexQuery.and(FlexQuery.eq("id", imageId), "user_id = ?", userId)
        );
        if (image == null) {
            throw ApiException.notFound("图片不存在");
        }
        return readBytesOf(image);
    }

    @Override
    public void deleteImageForUser(String userId, String imageId) {
        ImageEntity image = imageMapper.selectOneByQuery(
            FlexQuery.and(FlexQuery.eq("id", imageId), "user_id = ?", userId)
        );
        if (image == null) {
            return;
        }
        imageMapper.deleteById(imageId);
        storage.delete(storageKeyOf(image));
    }

    @Override
    public String parseSource(String source) {
        return switch ((source == null ? "" : source.trim().toLowerCase(Locale.ROOT))) {
            case "mask" -> "mask";
            case "generated" -> "generated";
            default -> "upload";
        };
    }

    // ===== 私有工具 =====

    private String buildKey(String userId, String id, String ext) {
        String prefix = properties.storage().keyPrefix();
        if (properties.storage().isCos()) {
            return prefix + userId + "/" + id + "." + ext;
        }
        // 本地模式：相对 uploadDir 的路径（与原有 ./upload/{userId}/{id}.{ext} 一致）。
        return userId + "/" + id + "." + ext;
    }

    private ImageFile toImageFile(ImageEntity image) {
        if (isCos(image)) {
            return new ImageFile(toResponseWithUrl(image), storage.accessUrl(storageKeyOf(image)), null);
        }
        return new ImageFile(toResponseWithUrl(image), accessUrlLocal(image), resolveLocalPath(image.getFilePath()));
    }

    private byte[] readBytesOf(ImageEntity image) {
        if (isCos(image)) {
            return storage.readBytes(storageKeyOf(image));
        }
        try {
            return Files.readAllBytes(resolveLocalPath(image.getFilePath()));
        } catch (IOException e) {
            throw ApiException.notFound("图片不存在");
        }
    }

    private String storageKeyOf(ImageEntity image) {
        return image.getStorageKey() != null && !image.getStorageKey().isBlank()
            ? image.getStorageKey()
            : image.getFilePath();
    }

    private boolean isCos(ImageEntity image) {
        return image != null && "cos".equalsIgnoreCase(image.getStorageType());
    }

    private String accessUrlLocal(ImageEntity image) {
        // 本地模式相对回退 URL，由控制器直接服务字节，无需直链。
        return "/api/images/" + image.getId();
    }

    private Path resolveLocalPath(String relPath) {
        if (relPath == null || relPath.isBlank()) {
            throw ApiException.notFound("图片不存在");
        }
        try {
            return FileStorageUtils.resolveUploadPath(properties.uploadDir(), relPath);
        } catch (IOException e) {
            throw ApiException.notFound("图片不存在");
        }
    }

    /** 生成对外访问 URL：COS 用 storage.accessUrl（实时预签名/公开直链），本地留空。 */
    private String resolveAccessUrl(ImageEntity image) {
        if (isCos(image)) {
            return storage.accessUrl(storageKeyOf(image));
        }
        return null;
    }

    private ImageResponse toResponseWithUrl(ImageEntity image) {
        ImageResponse base = imageDtoMapper.toResponse(image);
        // COS 模式实时生成访问 URL（预签名可能过期，公开直链稳定）；
        // 公开前缀模式下优先复用已存的稳定 publicUrl，避免重复拼接。
        String url = null;
        if (isCos(image)) {
            String stored = image.getPublicUrl();
            url = (stored != null && !stored.isBlank() && isPublicBaseUrlMode())
                ? stored
                : resolveAccessUrl(image);
        }
        return new ImageResponse(
            base.id(), base.userId(), base.filePath(), base.mime(), base.size(),
            base.sha256(), base.source(), base.createdAt(), url
        );
    }

    private boolean isPublicBaseUrlMode() {
        String base = properties.storage().publicBaseUrl();
        return base != null && !base.isBlank();
    }
}