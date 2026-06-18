package com.tripcanvas.backend.controller;

import com.tripcanvas.backend.common.web.ApiResponse;
import com.tripcanvas.backend.dto.request.ChangelogRequest;
import com.tripcanvas.backend.dto.response.ApiPayloads;
import com.tripcanvas.backend.dto.response.ChangelogEntryResponse;
import com.tripcanvas.backend.service.ChangelogService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class ChangelogController {
    private final ChangelogService changelogService;

    @GetMapping("/api/admin/changelog")
    public ApiPayloads.Changelogs list() {
        return new ApiPayloads.Changelogs(changelogService.list(true));
    }

    @PostMapping("/api/admin/changelog")
    @ResponseStatus(HttpStatus.CREATED)
    public ChangelogEntryResponse create(@Valid @RequestBody ChangelogRequest body) {
        return changelogService.create(body);
    }

    @PutMapping("/api/admin/changelog/{id}")
    public ChangelogEntryResponse update(@PathVariable String id, @Valid @RequestBody ChangelogRequest body) {
        return changelogService.update(id, body);
    }

    @DeleteMapping("/api/admin/changelog/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        changelogService.delete(id);
        return ApiResponse.ok();
    }
}
