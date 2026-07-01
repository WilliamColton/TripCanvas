package com.tripcanvas.backend.service;

import com.tripcanvas.backend.dto.response.ImageResponse;

public interface ImageService {
    ImageResponse saveImageBuffer(String userId, byte[] bytes, String mime, String source);

    ImageFile readImageFileForUser(String userId, String imageId);

    ImageFile readTemplatePreviewImageFile(String imageId);

    /** 读取图片字节，供生成任务使用（COS 模式从对象存储拉取，本地模式读磁盘）。 */
    byte[] readBytesForUser(String userId, String imageId);

    void deleteImageForUser(String userId, String imageId);

    String parseSource(String source);

    /**
     * 图片读取结果。
     * - 本地模式：path 非 null，accessUrl 为相对回退 URL（/api/images/{id}）。
     * - COS 模式：path 为 null，accessUrl 为预签名/公开直链（绝对 URL）。
     */
    record ImageFile(ImageResponse image, String accessUrl, java.nio.file.Path path) {
    }
}