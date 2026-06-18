package com.tripcanvas.backend.service.impl;

import com.tripcanvas.backend.dto.response.AnnouncementResponse;
import com.tripcanvas.backend.entity.AnnouncementEntity;
import com.tripcanvas.backend.mapper.AnnouncementMapper;
import com.tripcanvas.backend.service.AnnouncementService;
import com.tripcanvas.backend.structmapper.AnnouncementDtoMapper;
import com.tripcanvas.backend.util.Times;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AnnouncementServiceImpl implements AnnouncementService {
    private static final String ANNOUNCEMENT_ID = "default";
    private final AnnouncementMapper mapper;
    private final AnnouncementDtoMapper dtoMapper;

    @Override
    public AnnouncementResponse getAnnouncement() {
        AnnouncementEntity entity = mapper.selectOneById(ANNOUNCEMENT_ID);
        if (entity == null) {
            return new AnnouncementResponse("", false, 0L);
        }
        return dtoMapper.toResponse(entity);
    }

    @Override
    public AnnouncementResponse updateAnnouncement(String content, boolean enabled) {
        AnnouncementEntity entity = new AnnouncementEntity()
            .setId(ANNOUNCEMENT_ID)
            .setContent(content == null ? "" : content)
            .setEnabled(enabled ? 1 : 0)
            .setUpdatedAt(Times.nowMillis());
        if (mapper.selectOneById(ANNOUNCEMENT_ID) == null) {
            mapper.insert(entity);
        } else {
            mapper.update(entity);
        }
        return dtoMapper.toResponse(entity);
    }
}
