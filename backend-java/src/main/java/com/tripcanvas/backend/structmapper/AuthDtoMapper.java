package com.tripcanvas.backend.structmapper;

import com.tripcanvas.backend.dto.response.AdminUserResponse;
import com.tripcanvas.backend.dto.response.AuthUserResponse;
import com.tripcanvas.backend.dto.response.RedemptionCodeResponse;
import com.tripcanvas.backend.entity.RedemptionCodeEntity;
import com.tripcanvas.backend.entity.UserEntity;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface AuthDtoMapper {
    @Mapping(target = "username", expression = "java(nullToEmpty(entity.getUsername()))")
    @Mapping(target = "imageCount", source = "imageCount")
    @Mapping(target = "quota", expression = "java(nullToZero(entity.getQuota()))")
    @Mapping(target = "unlimitedQuota", expression = "java(nonZero(entity.getUnlimitedQuota()))")
    @Mapping(target = "usedCount", expression = "java(nullToZero(entity.getUsedCount()))")
    @Mapping(target = "needsMigration", expression = "java(entity.getPasswordHash() == null ? Boolean.TRUE : null)")
    @Mapping(target = "email", expression = "java(nullToEmpty(entity.getEmail()))")
    @Mapping(target = "emailVerified", expression = "java(entity.getEmailVerifiedAt() != null ? Boolean.TRUE : null)")
    AuthUserResponse toAuthUser(UserEntity entity, int imageCount);

    @Mapping(target = "username", expression = "java(nullToEmpty(entity.getUsername()))")
    @Mapping(target = "quota", expression = "java(nullToZero(entity.getQuota()))")
    @Mapping(target = "unlimitedQuota", expression = "java(nonZero(entity.getUnlimitedQuota()))")
    @Mapping(target = "usedCount", expression = "java(nullToZero(entity.getUsedCount()))")
    @Mapping(target = "createdAt", expression = "java(nullToZeroLong(entity.getCreatedAt()))")
    AdminUserResponse toAdminUser(UserEntity entity);

    @Mapping(target = "quota", expression = "java(nullToZero(entity.getQuota()))")
    @Mapping(target = "createdAt", expression = "java(nullToZeroLong(entity.getCreatedAt()))")
    RedemptionCodeResponse toCode(RedemptionCodeEntity entity);

    default int nullToZero(Integer value) {
        return value == null ? 0 : value;
    }

    default long nullToZeroLong(Long value) {
        return value == null ? 0L : value;
    }

    default boolean nonZero(Integer value) {
        return value != null && value != 0;
    }

    default String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
