package com.tripcanvas.backend.controller;

import com.tripcanvas.backend.common.web.ApiResponse;
import com.tripcanvas.backend.dto.request.TemplateRequests;
import com.tripcanvas.backend.dto.response.ApiPayloads;
import com.tripcanvas.backend.dto.response.ImageResponse;
import com.tripcanvas.backend.security.AuthContext;
import com.tripcanvas.backend.service.ImageService;
import com.tripcanvas.backend.service.PromptTemplateService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
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
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
public class TemplateController {
    private final PromptTemplateService templateService;
    private final ImageService imageService;

    @GetMapping("/api/templates")
    public ApiPayloads.Templates list(HttpServletRequest request) {
        return new ApiPayloads.Templates(templateService.listForUser(AuthContext.requireUserId(request)));
    }

    @GetMapping("/api/templates/{id}")
    public ApiPayloads.Template get(HttpServletRequest request, @PathVariable String id) {
        return new ApiPayloads.Template(templateService.getForUser(AuthContext.requireUserId(request), id));
    }

    @PostMapping("/api/templates")
    public ApiPayloads.Template create(HttpServletRequest request, @Valid @RequestBody TemplateRequests.PromptTemplateRequest body) {
        return new ApiPayloads.Template(templateService.createUserTemplate(AuthContext.requireUserId(request), body));
    }

    @PutMapping("/api/templates/{id}")
    public ApiPayloads.Template update(HttpServletRequest request, @PathVariable String id, @Valid @RequestBody TemplateRequests.PromptTemplateRequest body) {
        return new ApiPayloads.Template(templateService.updateUserTemplate(AuthContext.requireUserId(request), id, body));
    }

    @DeleteMapping("/api/templates/{id}")
    public ApiResponse<Void> delete(HttpServletRequest request, @PathVariable String id) {
        templateService.deleteUserTemplate(AuthContext.requireUserId(request), id);
        return ApiResponse.ok();
    }

    @PostMapping("/api/admin/templates/preview")
    public ApiPayloads.Prompt preview(@Valid @RequestBody TemplateRequests.PreviewTemplateRequest body) {
        return new ApiPayloads.Prompt(templateService.previewPrompt(body));
    }

    @PostMapping("/api/admin/template-preview-images")
    public ApiPayloads.PreviewImage uploadPreview(HttpServletRequest request, @RequestParam("image") MultipartFile file) throws IOException {
        String mime = file.getContentType() == null || file.getContentType().isBlank() ? "image/png" : file.getContentType();
        ImageResponse image = imageService.saveImageBuffer(AuthContext.adminUserId(request), file.getBytes(), mime, "upload");
        return new ApiPayloads.PreviewImage(image.id(), "/api/template-preview-images/" + image.id(), image.createdAt());
    }

    @GetMapping("/api/template-preview-images/{id}")
    public ResponseEntity<FileSystemResource> getPreviewImage(@PathVariable String id) {
        ImageService.ImageFile imageFile = imageService.readTemplatePreviewImageFile(id);
        return ResponseEntity.ok()
            .header(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .contentLength(imageFile.image().size())
            .contentType(MediaType.parseMediaType(imageFile.image().mime()))
            .body(new FileSystemResource(imageFile.path()));
    }

    @GetMapping("/api/admin/templates")
    public ApiPayloads.Templates adminList() {
        return new ApiPayloads.Templates(templateService.listForAdmin());
    }

    @PostMapping("/api/admin/templates")
    public ApiPayloads.Template adminCreate(@Valid @RequestBody TemplateRequests.PromptTemplateRequest body) {
        return new ApiPayloads.Template(templateService.createAdminTemplate(body));
    }

    @PutMapping("/api/admin/templates/{id}")
    public ApiPayloads.Template adminUpdate(@PathVariable String id, @Valid @RequestBody TemplateRequests.PromptTemplateRequest body) {
        return new ApiPayloads.Template(templateService.updateAdminTemplate(id, body));
    }

    @DeleteMapping("/api/admin/templates/{id}")
    public ApiResponse<Void> adminDelete(@PathVariable String id) {
        templateService.deleteAdminTemplate(id);
        return ApiResponse.ok();
    }

    @PutMapping("/api/admin/templates/{id}/toggle")
    public ApiPayloads.Template adminToggle(@PathVariable String id) {
        return new ApiPayloads.Template(templateService.toggleAdminTemplateStatus(id));
    }
}
