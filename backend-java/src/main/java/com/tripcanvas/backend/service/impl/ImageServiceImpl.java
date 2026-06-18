package com.tripcanvas.backend.service.impl;

import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.config.TripCanvasProperties;
import com.tripcanvas.backend.dto.response.ImageResponse;
import com.tripcanvas.backend.entity.ImageEntity;
import com.tripcanvas.backend.mapper.ImageMapper;
import com.tripcanvas.backend.mapper.PromptTemplateMapper;
import com.tripcanvas.backend.service.ImageService;
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

    @Override
    public ImageResponse saveImageBuffer(String userId, byte[] bytes, String mime, String source) {
        String sha256 = CryptoUtils.sha256Hex(bytes);
        ImageEntity existing = imageMapper.selectOneByQuery(
            FlexQuery.and(FlexQuery.eq("user_id", userId), "sha256 = ?", sha256)
        );
        if (existing != null) {
            return toResponse(existing);
        }
        String id = Ids.generate();
        String ext = MIME_EXT.getOrDefault(mime, "png");
        Path absPath;
        try {
            Path dir = FileStorageUtils.ensureUserUploadDir(properties.uploadDir(), userId);
            absPath = dir.resolve(id + "." + ext);
            Files.write(absPath, bytes);
        } catch (IOException e) {
            throw ApiException.internal("图片保存失败");
        }
        long now = Times.nowMillis();
        String relPath = FileStorageUtils.toUploadRelativePath(properties.uploadDir(), absPath);
        ImageEntity image = new ImageEntity()
            .setId(id)
            .setUserId(userId)
            .setFilePath(relPath)
            .setMime(mime)
            .setSize((long) bytes.length)
            .setSha256(sha256)
            .setSource(parseSource(source))
            .setCreatedAt(now);
        try {
            imageMapper.insert(image);
        } catch (Exception e) {
            try {
                Files.deleteIfExists(absPath);
            } catch (IOException ignored) {
            }
            throw ApiException.internal("图片保存失败");
        }
        return toResponse(image);
    }

    @Override
    public ImageFile readImageFileForUser(String userId, String imageId) {
        ImageEntity image = imageMapper.selectOneByQuery(
            FlexQuery.and(FlexQuery.eq("id", imageId), "user_id = ?", userId)
        );
        if (image == null) {
            throw ApiException.notFound("图片不存在");
        }
        return new ImageFile(toResponse(image), resolve(image.getFilePath()));
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
        return new ImageFile(toResponse(image), resolve(image.getFilePath()));
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
        try {
            Files.deleteIfExists(resolve(image.getFilePath()));
        } catch (Exception ignored) {
        }
    }

    @Override
    public String parseSource(String source) {
        return switch ((source == null ? "" : source.trim().toLowerCase(Locale.ROOT))) {
            case "mask" -> "mask";
            case "generated" -> "generated";
            default -> "upload";
        };
    }

    private Path resolve(String relPath) {
        try {
            return FileStorageUtils.resolveUploadPath(properties.uploadDir(), relPath);
        } catch (IOException e) {
            throw ApiException.notFound("图片不存在");
        }
    }

    private ImageResponse toResponse(ImageEntity image) {
        return imageDtoMapper.toResponse(image);
    }
}
