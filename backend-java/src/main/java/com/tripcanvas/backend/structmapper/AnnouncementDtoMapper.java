package com.tripcanvas.backend.structmapper;

import com.tripcanvas.backend.dto.response.AnnouncementResponse;
import com.tripcanvas.backend.entity.AnnouncementEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface AnnouncementDtoMapper {
    @Mapping(target = "enabled", expression = "java(toBoolean(entity.getEnabled()))")
    AnnouncementResponse toResponse(AnnouncementEntity entity);

    default boolean toBoolean(Integer value) {
        return value != null && value == 1;
    }
}
