package com.tripcanvas.backend.service;

import com.tripcanvas.backend.dto.response.ImageResponse;

public interface ImageService {
    ImageResponse saveImageBuffer(String userId, byte[] bytes, String mime, String source);

    ImageFile readImageFileForUser(String userId, String imageId);

    ImageFile readTemplatePreviewImageFile(String imageId);

    void deleteImageForUser(String userId, String imageId);

    String parseSource(String source);

    record ImageFile(ImageResponse image, java.nio.file.Path path) {
    }
}
