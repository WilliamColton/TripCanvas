package com.tripcanvas.backend.storage;

import com.qcloud.cos.COSClient;
import com.qcloud.cos.ClientConfig;
import com.qcloud.cos.auth.BasicCOSCredentials;
import com.qcloud.cos.auth.COSCredentials;
import com.qcloud.cos.exception.CosClientException;
import com.qcloud.cos.exception.CosServiceException;
import com.qcloud.cos.http.HttpProtocol;
import com.qcloud.cos.model.GeneratePresignedUrlRequest;
import com.qcloud.cos.model.ObjectMetadata;
import com.qcloud.cos.model.PutObjectRequest;
import com.qcloud.cos.model.COSObject;
import com.qcloud.cos.region.Region;
import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.config.TripCanvasProperties;
import java.io.ByteArrayInputStream;
import java.net.URL;
import java.util.Date;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * 腾讯云 COS 实现。私有桶 + 后端生成预签名 URL，浏览器直连 COS/CDN 加载，
 * 图片字节不再经过应用服务器。文档参考：https://cloud.tencent.com/document/product/436/10199
 *
 * <p>TODO 生产环境建议改用 STS 临时密钥（最小权限原则），当前先用环境变量注入的永久密钥。</p>
 */
@Service
@ConditionalOnProperty(prefix = "tripcanvas.storage", name = "type", havingValue = "cos")
public class CosImageStorageService implements ImageStorageService, AutoCloseable {

    private static final Logger log = LoggerFactory.getLogger(CosImageStorageService.class);

    private final TripCanvasProperties.Storage cfg;
    private final COSClient cosClient;

    public CosImageStorageService(TripCanvasProperties properties) {
        this.cfg = properties.storage();
        if (isBlank(cfg.secretId()) || isBlank(cfg.secretKey()) || isBlank(cfg.bucket()) || isBlank(cfg.region())) {
            throw new IllegalStateException("tripcanvas.storage.type=cos 但 secretId/secretKey/bucket/region 未配置");
        }
        COSCredentials cred = new BasicCOSCredentials(cfg.secretId(), cfg.secretKey());
        ClientConfig clientConfig = new ClientConfig(new Region(cfg.region()));
        clientConfig.setHttpProtocol(HttpProtocol.https);
        this.cosClient = new COSClient(cred, clientConfig);
        log.info("COS 存储已启用 bucket={} region={}", cfg.bucket(), cfg.region());
    }

    @Override
    public String type() {
        return "cos";
    }

    @Override
    public StoredObject save(String key, byte[] bytes, String mime) {
        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentLength(bytes.length);
        metadata.setContentType(mime == null || mime.isBlank() ? "application/octet-stream" : mime);
        // 图片内容不变（key 含去重 hash），可作 immutable 长缓存：浏览器/CDN 命中后刷新不重下载。
        metadata.setCacheControl("max-age=604800, immutable");
        try (ByteArrayInputStream input = new ByteArrayInputStream(bytes)) {
            PutObjectRequest request = new PutObjectRequest(cfg.bucket(), key, input, metadata);
            cosClient.putObject(request);
        } catch (CosClientException e) {
            log.error("COS 上传失败 key={}", key, e);
            throw ApiException.internal("图片保存失败");
        } catch (Exception e) {
            log.error("COS 上传异常 key={}", key, e);
            throw ApiException.internal("图片保存失败");
        }
        return new StoredObject(key, accessUrl(key));
    }

    @Override
    public byte[] readBytes(String key) {
        try (COSObject object = cosClient.getObject(cfg.bucket(), key)) {
            return object.getObjectContent().readAllBytes();
        } catch (CosClientException e) {
            log.error("COS 读取失败 key={}", key, e);
            throw ApiException.notFound("图片不存在");
        } catch (Exception e) {
            log.error("COS 读取异常 key={}", key, e);
            throw ApiException.internal("图片读取失败");
        }
    }

    @Override
    public String accessUrl(String key) {
        // 优先使用公开直链前缀（适合模板预览图等公开内容）。
        if (!isBlank(cfg.publicBaseUrl())) {
            String base = cfg.publicBaseUrl().replaceAll("/+$", "");
            return base + "/" + key;
        }
        // 否则生成短期预签名 GET URL。
        Date expiration = new Date(System.currentTimeMillis() + cfg.signedUrlTtlSeconds() * 1000L);
        GeneratePresignedUrlRequest request = new GeneratePresignedUrlRequest(cfg.bucket(), key, com.qcloud.cos.http.HttpMethodName.GET)
            .withExpiration(expiration);
        URL url = cosClient.generatePresignedUrl(request);
        return url == null ? null : url.toString();
    }

    @Override
    public void delete(String key) {
        try {
            cosClient.deleteObject(cfg.bucket(), key);
        } catch (CosClientException e) {
            log.warn("COS 删除失败 key={}", key, e);
        }
    }

    @Override
    public void close() {
        if (cosClient != null) {
            cosClient.shutdown();
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
