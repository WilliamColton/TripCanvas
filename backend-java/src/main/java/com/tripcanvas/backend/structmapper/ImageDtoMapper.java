package com.tripcanvas.backend.structmapper;

import com.tripcanvas.backend.dto.response.ImageResponse;
import com.tripcanvas.backend.entity.ImageEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface ImageDtoMapper {
    @Mapping(source = "publicUrl", target = "url")
    ImageResponse toResponse(ImageEntity entity);
}