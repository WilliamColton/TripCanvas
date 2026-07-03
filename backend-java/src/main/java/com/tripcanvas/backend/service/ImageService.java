package com.tripcanvas.backend.service;

import com.tripcanvas.backend.dto.response.ImageResponse;

public interface ImageService {
    ImageResponse saveImageBuffer(String userId, byte[] bytes, String mime, String source);

    UploadPrepare prepareUpload(String userId, String sha256, String mime, long size, String source);

    ImageResponse commitUpload(String userId, String id, String key, String sha256, String mime, long size, String source);

    ImageFile readImageFileForUser(String userId, String imageId);

    ImageFile readTemplatePreviewImageFile(String imageId);

    /** 读取图片字节，供生成任务使用（COS 模式从对象存储拉取，本地模式读磁盘）。 */
    byte[] readBytesForUser(String userId, String imageId);

    /** 一次查询返回字节和 mime，供 worker 加载输入图时避免读字节与读 mime 重复查同一行。 */
    ImageBytes readBytesAndMimeForUser(String userId, String imageId);

    void deleteImageForUser(String userId, String imageId);

    String parseSource(String source);

    /**
     * 图片读取结果。
     * - 本地模式：path 非 null，accessUrl 为相对回退 URL（/api/images/{id}）。
     * - COS 模式：path 为 null，accessUrl 为预签名/公开直链（绝对 URL）。
     */
record ImageFile(ImageResponse image, String accessUrl, java.nio.file.Path path) {
    }

    /** 图片字节 + mime，一次查询的结果。 */
    record ImageBytes(byte[] bytes, String mime) {
    }

    /**
     * 前端直传预备结果。
     * - deduplicated=true：sha256 命中已有图片，前端无需上传，existing 为已存图片（含直链）。
     * - fallback=true：存储不支持直传（本地模式），前端回退 multipart POST /api/images。
     * - 否则：返回 id/key/uploadUrl，前端 PUT 字节到 uploadUrl 后调 commitUpload 登记。
     */
    record UploadPrepare(boolean deduplicated, boolean fallback, String id, String key, String uploadUrl, ImageResponse existing) {
    }
}