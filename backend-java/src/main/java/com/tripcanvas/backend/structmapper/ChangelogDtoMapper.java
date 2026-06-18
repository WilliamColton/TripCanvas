package com.tripcanvas.backend.structmapper;

import com.tripcanvas.backend.dto.response.ChangelogEntryResponse;
import com.tripcanvas.backend.entity.ChangelogEntryEntity;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ChangelogDtoMapper {
    @Mapping(target = "published", expression = "java(toBoolean(entity.getPublished()))")
    ChangelogEntryResponse toResponse(ChangelogEntryEntity entity);

    List<ChangelogEntryResponse> toResponses(List<ChangelogEntryEntity> entities);

    default boolean toBoolean(Integer value) {
        return value != null && value == 1;
    }
}
