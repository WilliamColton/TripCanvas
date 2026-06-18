package com.tripcanvas.backend.structmapper;

import com.tripcanvas.backend.dto.response.FeedbackResponse;
import com.tripcanvas.backend.entity.FeedbackEntity;
import java.util.List;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface FeedbackDtoMapper {
    FeedbackResponse toResponse(FeedbackEntity entity);

    List<FeedbackResponse> toResponses(List<FeedbackEntity> entities);
}
