package com.tripcanvas.backend.service;

import com.tripcanvas.backend.dto.request.ChangelogRequest;
import com.tripcanvas.backend.dto.response.ChangelogEntryResponse;
import java.util.List;

public interface ChangelogService {
    List<ChangelogEntryResponse> list(boolean includeDrafts);

    ChangelogEntryResponse latestPublished();

    ChangelogEntryResponse create(ChangelogRequest request);

    ChangelogEntryResponse update(String id, ChangelogRequest request);

    void delete(String id);
}
