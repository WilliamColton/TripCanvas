package com.tripcanvas.backend.controller;

import com.tripcanvas.backend.common.web.ApiResponse;
import com.tripcanvas.backend.dto.response.AnnouncementResponse;
import com.tripcanvas.backend.dto.response.ChangelogEntryResponse;
import com.tripcanvas.backend.dto.response.ApiPayloads;
import com.tripcanvas.backend.dto.response.AppConfigResponse;
import com.tripcanvas.backend.service.AnnouncementService;
import com.tripcanvas.backend.service.AppConfigService;
import com.tripcanvas.backend.service.ChangelogService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class PublicController {
    private final AppConfigService appConfigService;
    private final AnnouncementService announcementService;
    private final ChangelogService changelogService;

    @GetMapping("/api/health")
    public ApiResponse<Void> health() {
        return ApiResponse.ok();
    }

    @GetMapping("/api/config/public")
    public AppConfigResponse configPublic() {
        return appConfigService.publicConfig();
    }

    @GetMapping("/api/announcement")
    public AnnouncementResponse announcement() {
        return announcementService.getAnnouncement();
    }

    @GetMapping("/api/changelog/latest")
    public ApiPayloads.Changelog latestChangelog() {
        ChangelogEntryResponse entry = changelogService.latestPublished();
        return new ApiPayloads.Changelog(entry);
    }

    @GetMapping("/api/changelog")
    public ApiPayloads.Changelogs changelogs() {
        return new ApiPayloads.Changelogs(changelogService.list(false));
    }
}
