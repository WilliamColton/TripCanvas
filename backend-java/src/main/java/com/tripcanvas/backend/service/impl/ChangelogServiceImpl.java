package com.tripcanvas.backend.service.impl;

import com.alicp.jetcache.Cache;
import com.alicp.jetcache.CacheManager;
import com.tripcanvas.backend.cache.CacheNames;
import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.config.JetCacheConfigs;
import com.tripcanvas.backend.dto.request.ChangelogRequest;
import com.tripcanvas.backend.dto.response.ChangelogEntryResponse;
import com.tripcanvas.backend.entity.ChangelogEntryEntity;
import com.tripcanvas.backend.mapper.ChangelogEntryMapper;
import com.tripcanvas.backend.service.ChangelogService;
import com.tripcanvas.backend.structmapper.ChangelogDtoMapper;
import com.tripcanvas.backend.util.FlexQuery;
import com.tripcanvas.backend.util.Ids;
import com.tripcanvas.backend.util.Times;
import jakarta.annotation.PostConstruct;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ChangelogServiceImpl implements ChangelogService {
    private final ChangelogEntryMapper mapper;
    private final ChangelogDtoMapper dtoMapper;
    private final CacheManager cacheManager;

    private Cache<String, List<ChangelogEntryResponse>> changelogListCache;
    private Cache<String, ChangelogEntryResponse> changelogLatestCache;

    @PostConstruct
    private void initCaches() {
        changelogListCache = cacheManager.getOrCreateCache(
            JetCacheConfigs.local(CacheNames.CHANGELOG_LIST, CacheNames.SINGLE_ENTRY_LIMIT)
        );
        changelogLatestCache = cacheManager.getOrCreateCache(
            JetCacheConfigs.local(CacheNames.CHANGELOG_LATEST, CacheNames.SINGLE_ENTRY_LIMIT)
        );
    }

    @Override
    public List<ChangelogEntryResponse> list(boolean includeDrafts) {
        // public 与 admin 必须分 key，避免草稿泄漏到 public 接口
        String key = includeDrafts ? CacheNames.KEY_CHANGELOG_ADMIN : CacheNames.KEY_CHANGELOG_PUBLIC;
        List<ChangelogEntryResponse> cached = changelogListCache.get(key);
        if (cached != null) {
            return cached;
        }
        var query = FlexQuery.orderBy(includeDrafts ? com.mybatisflex.core.query.QueryWrapper.create() : FlexQuery.eq("published", 1), "published_at DESC, updated_at DESC, created_at DESC");
        List<ChangelogEntryResponse> response = List.copyOf(dtoMapper.toResponses(mapper.selectListByQuery(query)));
        changelogListCache.put(key, response);
        return response;
    }

    @Override
    public ChangelogEntryResponse latestPublished() {
        ChangelogEntryResponse cached = changelogLatestCache.get(CacheNames.KEY_CHANGELOG_LATEST);
        if (cached != null) {
            return cached;
        }
        var list = mapper.selectListByQuery(FlexQuery.orderBy(FlexQuery.eq("published", 1), "published_at DESC, updated_at DESC, created_at DESC"));
        // 空结果不缓存，避免 null 无法与“未命中”区分导致每次穿透
        ChangelogEntryResponse response = list.isEmpty() ? null : dtoMapper.toResponse(list.get(0));
        if (response != null) {
            changelogLatestCache.put(CacheNames.KEY_CHANGELOG_LATEST, response);
        }
        return response;
    }

    @Override
    public ChangelogEntryResponse create(ChangelogRequest request) {
        NormalizedInput input = normalize(request);
        long now = Times.nowMillis();
        ChangelogEntryEntity entity = new ChangelogEntryEntity()
            .setId(Ids.generate())
            .setVersion(input.version())
            .setTitle(input.title())
            .setContent(input.content())
            .setPublished(input.published() ? 1 : 0)
            .setCreatedAt(now)
            .setUpdatedAt(now)
            .setPublishedAt(input.published() ? now : null);
        mapper.insert(entity);
        ChangelogEntryResponse response = dtoMapper.toResponse(entity);
        invalidateChangelogCache();
        return response;
    }

    @Override
    public ChangelogEntryResponse update(String id, ChangelogRequest request) {
        ChangelogEntryEntity entity = mapper.selectOneById(id);
        if (entity == null) {
            throw ApiException.notFound("更新日志不存在");
        }
        NormalizedInput input = normalize(request);
        long now = Times.nowMillis();
        entity.setVersion(input.version())
            .setTitle(input.title())
            .setContent(input.content())
            .setPublished(input.published() ? 1 : 0)
            .setUpdatedAt(now);
        if (input.published() && entity.getPublishedAt() == null) {
            entity.setPublishedAt(now);
        }
        mapper.update(entity);
        ChangelogEntryResponse response = dtoMapper.toResponse(entity);
        invalidateChangelogCache();
        return response;
    }

    @Override
    public void delete(String id) {
        int affected = mapper.deleteById(id);
        if (affected == 0) {
            throw ApiException.notFound("更新日志不存在");
        }
        invalidateChangelogCache();
    }

    private void invalidateChangelogCache() {
        changelogListCache.remove(CacheNames.KEY_CHANGELOG_PUBLIC);
        changelogListCache.remove(CacheNames.KEY_CHANGELOG_ADMIN);
        changelogLatestCache.remove(CacheNames.KEY_CHANGELOG_LATEST);
    }

    private NormalizedInput normalize(ChangelogRequest request) {
        String version = trim(request.version());
        String title = trim(request.title());
        String content = trim(request.content());
        boolean published = Boolean.TRUE.equals(request.published());
        if (published && version.isEmpty()) {
            throw ApiException.badRequest("发布更新日志前请填写版本号");
        }
        if (version.codePointCount(0, version.length()) > 64) {
            throw ApiException.badRequest("版本号最多 64 字");
        }
        if (title.codePointCount(0, title.length()) > 100) {
            throw ApiException.badRequest("标题最多 100 字");
        }
        if (content.codePointCount(0, content.length()) > 20000) {
            throw ApiException.badRequest("更新日志内容最多 20000 字");
        }
        return new NormalizedInput(version, title, content, published);
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private record NormalizedInput(String version, String title, String content, boolean published) {
    }
}
