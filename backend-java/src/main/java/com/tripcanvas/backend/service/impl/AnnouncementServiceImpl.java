package com.tripcanvas.backend.service.impl;

import com.alicp.jetcache.Cache;
import com.alicp.jetcache.CacheManager;
import com.tripcanvas.backend.cache.CacheNames;
import com.tripcanvas.backend.config.JetCacheConfigs;
import com.tripcanvas.backend.dto.response.AnnouncementResponse;
import com.tripcanvas.backend.entity.AnnouncementEntity;
import com.tripcanvas.backend.mapper.AnnouncementMapper;
import com.tripcanvas.backend.service.AnnouncementService;
import com.tripcanvas.backend.structmapper.AnnouncementDtoMapper;
import com.tripcanvas.backend.util.Times;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AnnouncementServiceImpl implements AnnouncementService {
    private static final String ANNOUNCEMENT_ID = "default";
    private final AnnouncementMapper mapper;
    private final AnnouncementDtoMapper dtoMapper;
    private final CacheManager cacheManager;

    private Cache<String, AnnouncementResponse> announcementCache;

    @PostConstruct
    private void initCaches() {
        announcementCache = cacheManager.getOrCreateCache(
            JetCacheConfigs.local(CacheNames.ANNOUNCEMENT, CacheNames.SINGLE_ENTRY_LIMIT)
        );
    }

    @Override
    public AnnouncementResponse getAnnouncement() {
        AnnouncementResponse cached = announcementCache.get(CacheNames.KEY_ANNOUNCEMENT);
        if (cached != null) {
            return cached;
        }
        AnnouncementEntity entity = mapper.selectOneById(ANNOUNCEMENT_ID);
        AnnouncementResponse response = entity == null
            ? new AnnouncementResponse("", false, 0L)
            : dtoMapper.toResponse(entity);
        announcementCache.put(CacheNames.KEY_ANNOUNCEMENT, response);
        return response;
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
        AnnouncementResponse response = dtoMapper.toResponse(entity);
        // 写库成功后直接覆盖缓存，避免 public/admin 两侧读到旧公告
        announcementCache.put(CacheNames.KEY_ANNOUNCEMENT, response);
        return response;
    }
}
