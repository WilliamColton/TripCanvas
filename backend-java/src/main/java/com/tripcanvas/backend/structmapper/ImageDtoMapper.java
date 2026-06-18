package com.tripcanvas.backend.structmapper;

import com.tripcanvas.backend.dto.response.ImageResponse;
import com.tripcanvas.backend.entity.ImageEntity;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface ImageDtoMapper {
    ImageResponse toResponse(ImageEntity entity);
}
