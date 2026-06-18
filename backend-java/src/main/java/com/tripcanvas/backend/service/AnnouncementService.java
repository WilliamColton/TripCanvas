package com.tripcanvas.backend.service;

import com.tripcanvas.backend.dto.response.AnnouncementResponse;

public interface AnnouncementService {
    AnnouncementResponse getAnnouncement();

    AnnouncementResponse updateAnnouncement(String content, boolean enabled);
}
