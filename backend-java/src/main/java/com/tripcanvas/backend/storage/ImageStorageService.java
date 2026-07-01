package com.tripcanvas.backend.storage;

/**
 * 图片存储抽象层。屏蔽本地文件系统与腾讯云 COS 的差异。
 *
 * <p>key 的含义：本地模式为相对 uploadDir 的路径（如 userId/id.ext）；COS 模式为对象 key（如 images/userId/id.ext）。
 * 由 {@link com.tripcanvas.backend.service.ImageService} 实现负责计算 key。</p>
 */
public interface ImageStorageService {

    /** 存储类型标识："local" 或 "cos"。 */
    String type();

    /**
     * 保存图片字节，返回存储 key 与对外访问 URL。
     * URL 为直链（COS 预签名或公开直链）；本地模式返回 null（由控制器兜底 /api/images/{id}）。
     */
    StoredObject save(String key, byte[] bytes, String mime);

    /** 读取图片字节，供生成任务使用。 */
    byte[] readBytes(String key);

    /**
     * 生成对外访问 URL。COS 模式返回预签名/公开直链；本地模式返回 null。
     */
    String accessUrl(String key);

    /** 删除存储对象。 */
    void delete(String key);

    record StoredObject(String key, String url) {
    }
}
