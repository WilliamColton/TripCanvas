package com.tripcanvas.backend.controller;

import com.tripcanvas.backend.dto.response.ImageResponse;
import com.tripcanvas.backend.common.web.ApiResponse;
import com.tripcanvas.backend.dto.response.ApiPayloads;
import com.tripcanvas.backend.security.AuthContext;
import com.tripcanvas.backend.service.ImageService;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
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
        return new ApiPayloads.ImageUpload(image.id(), "/api/images/" + image.id(), image.createdAt(), image.source());
    }

    @GetMapping("/{id}")
    public ResponseEntity<FileSystemResource> get(HttpServletRequest request, @PathVariable String id) {
        ImageService.ImageFile imageFile = imageService.readImageFileForUser(AuthContext.requireUserId(request), id);
        return ResponseEntity.ok()
            .header(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "*")
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
