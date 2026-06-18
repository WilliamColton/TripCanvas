package com.tripcanvas.backend.service.impl;

import com.mybatisflex.core.query.QueryWrapper;
import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.dto.response.FeedbackResponse;
import com.tripcanvas.backend.entity.FeedbackEntity;
import com.tripcanvas.backend.mapper.FeedbackMapper;
import com.tripcanvas.backend.service.FeedbackService;
import com.tripcanvas.backend.structmapper.FeedbackDtoMapper;
import com.tripcanvas.backend.util.FlexQuery;
import com.tripcanvas.backend.util.Ids;
import com.tripcanvas.backend.util.Times;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class FeedbackServiceImpl implements FeedbackService {
    private final FeedbackMapper mapper;
    private final FeedbackDtoMapper dtoMapper;

    @Override
    public FeedbackResponse create(String userId, String userLabel, String category, String content, String contact) {
        if (!isValidCategory(category)) {
            throw ApiException.badRequest("反馈分类无效");
        }
        String body = content == null ? "" : content.trim();
        if (body.isEmpty()) {
            throw ApiException.badRequest("请填写问题描述");
        }
        if (body.codePointCount(0, body.length()) > 2000) {
            throw ApiException.badRequest("问题描述最多 2000 字");
        }
        String contactValue = contact == null ? "" : contact.trim();
        if (contactValue.codePointCount(0, contactValue.length()) > 200) {
            throw ApiException.badRequest("联系方式最多 200 字");
        }
        long now = Times.nowMillis();
        FeedbackEntity entity = new FeedbackEntity()
            .setId(Ids.generate())
            .setUserId(userId)
            .setUserLabel(userLabel)
            .setCategory(category)
            .setContent(body)
            .setContact(contactValue)
            .setStatus("open")
            .setCreatedAt(now)
            .setUpdatedAt(now);
        mapper.insert(entity);
        return dtoMapper.toResponse(entity);
    }

    @Override
    public List<FeedbackResponse> list(String status) {
        QueryWrapper query = QueryWrapper.create();
        if (status != null && !status.isBlank()) {
            if (!isValidStatus(status)) {
                throw ApiException.badRequest("反馈状态无效");
            }
            query = FlexQuery.eq("status", status);
        }
        return dtoMapper.toResponses(mapper.selectListByQuery(FlexQuery.orderBy(query, "created_at DESC")));
    }

    @Override
    public FeedbackResponse updateStatus(String id, String status) {
        if (!isValidStatus(status)) {
            throw ApiException.badRequest("反馈状态无效");
        }
        FeedbackEntity entity = mapper.selectOneById(id);
        if (entity == null) {
            throw ApiException.notFound("反馈不存在");
        }
        entity.setStatus(status).setUpdatedAt(Times.nowMillis());
        mapper.update(entity);
        return dtoMapper.toResponse(entity);
    }

    private boolean isValidCategory(String category) {
        return "bug".equals(category) || "feature".equals(category);
    }

    private boolean isValidStatus(String status) {
        return "open".equals(status) || "reviewing".equals(status) || "resolved".equals(status);
    }

}
