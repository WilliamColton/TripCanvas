package com.tripcanvas.backend.structmapper;

import com.tripcanvas.backend.dto.TemplateInputs;
import com.tripcanvas.backend.dto.response.TaskRecordResponse;
import com.tripcanvas.backend.entity.TaskEntity;
import com.tripcanvas.backend.util.JsonUtils;
import java.util.ArrayList;
import java.util.List;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

@Mapper(componentModel = "spring", imports = {JsonUtils.class, TemplateInputs.class})
public interface TaskDtoMapper {
    @Mapping(target = "id", source = "task.id")
    @Mapping(target = "userId", source = "userId")
    @Mapping(target = "prompt", expression = "java(nullToEmpty(task.prompt()))")
    @Mapping(target = "promptMode", expression = "java(defaultPromptMode(task.promptMode()))")
    @Mapping(target = "templateId", expression = "java(emptyToNull(task.templateId()))")
    @Mapping(target = "templateResolutionId", expression = "java(emptyToNull(task.templateResolutionId()))")
    @Mapping(target = "templateResolutionName", expression = "java(emptyToNull(task.templateResolutionName()))")
    @Mapping(target = "templateTitleSnapshot", expression = "java(emptyToNull(task.templateTitle()))")
    @Mapping(target = "templateVersion", expression = "java(task.templateVersion() == null ? 0 : task.templateVersion())")
    @Mapping(target = "templateInputsJson", expression = "java(task.templateInputs() == null ? null : JsonUtils.stringify(task.templateInputs().values()))")
    @Mapping(target = "userPrompt", expression = "java(emptyToNull(task.userPrompt()))")
    @Mapping(target = "assembledPrompt", expression = "java(emptyToNull(task.assembledPrompt()))")
    @Mapping(target = "paramsJson", expression = "java(JsonUtils.stringify(task.params()))")
    @Mapping(target = "actualParamsJson", expression = "java(task.actualParams() == null ? null : JsonUtils.stringify(task.actualParams()))")
    @Mapping(target = "actualParamsByImageJson", expression = "java(task.actualParamsByImage() == null ? null : JsonUtils.stringify(task.actualParamsByImage()))")
    @Mapping(target = "revisedPromptByImageJson", expression = "java(task.revisedPromptByImage() == null ? null : JsonUtils.stringify(task.revisedPromptByImage()))")
    @Mapping(target = "inputImageIdsJson", expression = "java(JsonUtils.stringify(task.inputImageIds() == null ? java.util.List.of() : task.inputImageIds()))")
    @Mapping(target = "maskTargetImageId", source = "task.maskTargetImageId")
    @Mapping(target = "maskImageId", source = "task.maskImageId")
    @Mapping(target = "outputImageIdsJson", expression = "java(JsonUtils.stringify(task.outputImages() == null ? java.util.List.of() : task.outputImages()))")
    @Mapping(target = "status", source = "task.status")
    @Mapping(target = "error", source = "task.error")
    @Mapping(target = "isFavorite", expression = "java(booleanToInt(task.isFavorite()))")
    @Mapping(target = "createdAt", source = "task.createdAt")
    @Mapping(target = "finishedAt", source = "task.finishedAt")
    @Mapping(target = "elapsed", source = "task.elapsed")
    @Mapping(target = "apiMode", expression = "java(emptyToNull(task.apiMode()))")
    @Mapping(target = "codexCli", expression = "java(booleanToInt(task.codexCli()))")
    TaskEntity toEntity(String userId, TaskRecordResponse task);

    @Mapping(target = "promptMode", expression = "java(defaultPromptMode(entity.getPromptMode()))")
    @Mapping(target = "templateResolutionId", expression = "java(emptyToNull(entity.getTemplateResolutionId()))")
    @Mapping(target = "templateResolutionName", expression = "java(emptyToNull(entity.getTemplateResolutionName()))")
    @Mapping(target = "templateTitle", source = "templateTitleSnapshot")
    @Mapping(target = "templateInputs", expression = "java(new TemplateInputs(JsonUtils.parseObjectMap(entity.getTemplateInputsJson())))")
    @Mapping(target = "params", expression = "java(JsonUtils.parseTaskParams(entity.getParamsJson()))")
    @Mapping(target = "actualParams", expression = "java(JsonUtils.parseTaskParams(entity.getActualParamsJson()))")
    @Mapping(target = "actualParamsByImage", expression = "java(JsonUtils.parseTaskParamsMap(entity.getActualParamsByImageJson()))")
    @Mapping(target = "revisedPromptByImage", expression = "java(JsonUtils.parseStringMap(entity.getRevisedPromptByImageJson()))")
    @Mapping(target = "inputImageIds", expression = "java(nonNullList(JsonUtils.parseStringList(entity.getInputImageIdsJson())))")
    @Mapping(target = "outputImages", expression = "java(nonNullList(JsonUtils.parseStringList(entity.getOutputImageIdsJson())))")
    @Mapping(target = "isFavorite", expression = "java(entity.getIsFavorite() != null && entity.getIsFavorite() == 1)")
    @Mapping(target = "createdAt", expression = "java(entity.getCreatedAt() == null ? 0L : entity.getCreatedAt())")
    @Mapping(target = "codexCli", expression = "java(entity.getCodexCli() != null && entity.getCodexCli() == 1)")
    TaskRecordResponse toResponse(TaskEntity entity);

    default Integer booleanToInt(Boolean value) {
        return Boolean.TRUE.equals(value) ? 1 : 0;
    }

    default List<String> nonNullList(List<String> input) {
        return input == null ? new ArrayList<>() : input;
    }

    @Named("defaultPromptMode")
    default String defaultPromptMode(String value) {
        return value == null || value.isBlank() ? "freeform" : value;
    }

    @Named("emptyToNull")
    default String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    @Named("nullToEmpty")
    default String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
