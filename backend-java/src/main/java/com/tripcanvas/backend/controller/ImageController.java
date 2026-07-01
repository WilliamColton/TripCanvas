package com.tripcanvas.backend.controller;

import com.tripcanvas.backend.dto.response.ImageResponse;
import com.tripcanvas.backend.common.web.ApiResponse;
import com.tripcanvas.backend.dto.response.ApiPayloads;
import com.tripcanvas.backend.security.AuthContext;
import com.tripcanvas.backend.service.ImageService;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.net.URI;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/images")
@RequiredArgsConstructor
public class ImageController {
    private final ImageService imageService;

    @PostMapping
    public ApiPayloads.ImageUpload upload(HttpServletRequest request, @RequestParam("image") MultipartFile file, @RequestParam(value = "source", required = false) String source) throws IOException {
        String mime = file.getContentType() == null || file.getContentType().isBlank() ? "image/png" : file.getContentType();
        ImageResponse image = imageService.saveImageBuffer(AuthContext.requireUserId(request), file.getBytes(), mime, source);
        // url：COS 模式为预签名/公开直链（前端 <img> 直连）；本地模式回退 /api/images/{id}。
        String url = image.url() != null && !image.url().isBlank() ? image.url() : "/api/images/" + image.id();
        return new ApiPayloads.ImageUpload(image.id(), url, image.createdAt(), image.source());
    }

    /**
     * 解析图片对外访问直链。COS 模式返回预签名 URL，本地模式返回相对 /api/images/{id}。
     * 前端按 id 懒解析后缓存，<img> 直连 COS，字节不再经过应用服务器。
     */
    @GetMapping("/{id}/url")
    public ResponseEntity<ApiPayloads.ImageUrl> resolveUrl(HttpServletRequest request, @PathVariable String id) {
        ImageService.ImageFile file = imageService.readImageFileForUser(AuthContext.requireUserId(request), id);
        String url = file.accessUrl() != null && !file.accessUrl().isBlank()
            ? file.accessUrl()
            : "/api/images/" + id;
        return ResponseEntity.ok()
            .body(new ApiPayloads.ImageUrl(url, file.image().mime(), file.image().size()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(HttpServletRequest request, @PathVariable String id) {
        ImageService.ImageFile imageFile = imageService.readImageFileForUser(AuthContext.requireUserId(request), id);
        // COS 模式：302 跳转直链，浏览器直连 COS；本地模式：流式返回磁盘字节。
        if (imageFile.path() == null && imageFile.accessUrl() != null && !imageFile.accessUrl().isBlank()) {
            return ResponseEntity.status(302)
                .location(URI.create(imageFile.accessUrl()))
                .build();
        }
        return ResponseEntity.ok()
            .contentLength(imageFile.image().size())
            .contentType(MediaType.parseMediaType(imageFile.image().mime()))
            .body(new FileSystemResource(imageFile.path()));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(HttpServletRequest request, @PathVariable String id) {
        imageService.deleteImageForUser(AuthContext.requireUserId(request), id);
        return ApiResponse.ok();
    }
}