package com.tripcanvas.backend.service.impl;

import com.alicp.jetcache.Cache;
import com.alicp.jetcache.CacheManager;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.mybatisflex.core.query.QueryWrapper;
import com.tripcanvas.backend.cache.CacheNames;
import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.config.JetCacheConfigs;
import com.tripcanvas.backend.dto.TemplateInputs;
import com.tripcanvas.backend.dto.request.TemplateRequests;
import com.tripcanvas.backend.dto.response.PromptTemplateFieldResponse;
import com.tripcanvas.backend.dto.response.PromptTemplateQualityOptionResponse;
import com.tripcanvas.backend.dto.response.PromptTemplateResolutionOptionResponse;
import com.tripcanvas.backend.dto.response.PromptTemplateResponse;
import com.tripcanvas.backend.entity.PromptTemplateEntity;
import com.tripcanvas.backend.mapper.PromptTemplateMapper;
import com.tripcanvas.backend.service.PromptTemplateService;
import com.tripcanvas.backend.util.FlexQuery;
import com.tripcanvas.backend.util.Ids;
import com.tripcanvas.backend.util.ImageSizeUtils;
import com.tripcanvas.backend.util.JsonUtils;
import com.tripcanvas.backend.util.Times;
import jakarta.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PromptTemplateServiceImpl implements PromptTemplateService {
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{([^{}]+)}");

    private final PromptTemplateMapper mapper;
    private final CacheManager cacheManager;

    private Cache<String, List<PromptTemplateResponse>> templateUserListCache;
    private Cache<String, PromptTemplateResponse> templateUserDetailCache;
    private Cache<String, List<PromptTemplateResponse>> templateAdminListCache;

    // 模板写操作后递增 epoch，使所有用户级缓存 key 整体失效（无法枚举所有 userId）。
    private final AtomicLong templateCacheEpoch = new AtomicLong();

    @PostConstruct
    private void initCaches() {
        templateUserListCache = cacheManager.getOrCreateCache(
            JetCacheConfigs.local(CacheNames.TEMPLATE_USER_LIST, CacheNames.LOCAL_LIMIT)
        );
        templateUserDetailCache = cacheManager.getOrCreateCache(
            JetCacheConfigs.local(CacheNames.TEMPLATE_USER_DETAIL, CacheNames.LOCAL_LIMIT)
        );
        templateAdminListCache = cacheManager.getOrCreateCache(
            JetCacheConfigs.local(CacheNames.TEMPLATE_ADMIN_LIST, CacheNames.SINGLE_ENTRY_LIMIT)
        );
    }

    @Override
    public List<PromptTemplateResponse> listForUser(String userId) {
        String key = templateCacheKey("user:list", userId);
        List<PromptTemplateResponse> cached = templateUserListCache.get(key);
        if (cached != null) {
            return cached;
        }
        QueryWrapper query = FlexQuery.orderBy(
            FlexQuery.where("(source = ? AND status = ? AND visibility = ?) OR (source = ? AND owner_user_id = ? AND status != ?)",
                "admin", "published", "public", "user", userId, "archived"),
            "sort_order ASC, updated_at DESC"
        );
        List<PromptTemplateResponse> response = mapper.selectListByQuery(query).stream().map(t -> toResponse(t, shouldExpose(userId, t, false), true)).toList();
        templateUserListCache.put(key, response);
        return response;
    }

    @Override
    public PromptTemplateResponse getForUser(String userId, String templateId) {
        String key = templateCacheKey("user:detail", userId, templateId);
        PromptTemplateResponse cached = templateUserDetailCache.get(key);
        if (cached != null) {
            return cached;
        }
        PromptTemplateEntity entity = findTemplateForUser(userId, templateId);
        PromptTemplateResponse response = toResponse(entity, shouldExpose(userId, entity, false), true);
        templateUserDetailCache.put(key, response);
        return response;
    }

    @Override
    public PromptTemplateResponse createUserTemplate(String userId, TemplateRequests.PromptTemplateRequest request) {
        NormalizedTemplate input = normalize(request, false, "private", request.status() == null || request.status().isBlank() ? "published" : request.status());
        long now = Times.nowMillis();
        PromptTemplateEntity entity = baseEntity(input, now)
            .setId(Ids.generate())
            .setOwnerUserId(userId)
            .setSource("user")
            .setVisibility("private")
            .setVersion(1)
            .setCreatedAt(now);
        mapper.insert(entity);
        invalidateTemplateCache();
        return toResponse(entity, true, false);
    }

    @Override
    public PromptTemplateResponse updateUserTemplate(String userId, String templateId, TemplateRequests.PromptTemplateRequest request) {
        PromptTemplateEntity entity = mapper.selectOneByQuery(FlexQuery.where("id = ? AND source = ? AND owner_user_id = ?", templateId, "user", userId));
        if (entity == null) {
            throw ApiException.badRequest("模板不存在");
        }
        String status = request.status() == null || request.status().isBlank() ? entity.getStatus() : request.status();
        NormalizedTemplate input = normalize(request, false, "private", status);
        apply(entity, input);
        entity.setVersion(nullToZero(entity.getVersion()) + 1);
        mapper.update(entity);
        invalidateTemplateCache();
        return toResponse(entity, true, false);
    }

    @Override
    public void deleteUserTemplate(String userId, String templateId) {
        int affected = mapper.deleteByQuery(FlexQuery.where("id = ? AND source = ? AND owner_user_id = ?", templateId, "user", userId));
        if (affected == 0) {
            throw ApiException.badRequest("模板不存在");
        }
        invalidateTemplateCache();
    }

    @Override
    public List<PromptTemplateResponse> listForAdmin() {
        String key = templateCacheKey("admin:list", CacheNames.KEY_TEMPLATE_ADMIN_ALL);
        List<PromptTemplateResponse> cached = templateAdminListCache.get(key);
        if (cached != null) {
            return cached;
        }
        List<PromptTemplateResponse> response = mapper.selectListByQuery(FlexQuery.orderBy(QueryWrapper.create(), "sort_order ASC, updated_at DESC")).stream()
            .map(t -> toResponse(t, true, true))
            .toList();
        templateAdminListCache.put(key, response);
        return response;
    }

    @Override
    public PromptTemplateResponse createAdminTemplate(TemplateRequests.PromptTemplateRequest request) {
        NormalizedTemplate input = normalize(request, true, "public", request.status() == null || request.status().isBlank() ? "draft" : request.status());
        long now = Times.nowMillis();
        PromptTemplateEntity entity = baseEntity(input, now)
            .setId(Ids.generate())
            .setSource("admin")
            .setVisibility("public")
            .setVersion(1)
            .setCreatedAt(now);
        mapper.insert(entity);
        invalidateTemplateCache();
        return toResponse(entity, true, true);
    }

    @Override
    public PromptTemplateResponse updateAdminTemplate(String templateId, TemplateRequests.PromptTemplateRequest request) {
        PromptTemplateEntity entity = selectById(templateId);
        String visibility = request.visibility() == null || request.visibility().isBlank()
            ? ("admin".equals(entity.getSource()) ? "public" : entity.getVisibility())
            : request.visibility();
        String status = request.status() == null || request.status().isBlank() ? entity.getStatus() : request.status();
        NormalizedTemplate input = normalize(request, true, visibility, status);
        apply(entity, input);
        entity.setVersion(nullToZero(entity.getVersion()) + 1);
        mapper.update(entity);
        invalidateTemplateCache();
        return toResponse(entity, true, true);
    }

    @Override
    public void deleteAdminTemplate(String templateId) {
        int affected = mapper.deleteById(templateId);
        if (affected == 0) {
            throw ApiException.badRequest("模板不存在");
        }
        invalidateTemplateCache();
    }

    @Override
    public PromptTemplateResponse toggleAdminTemplateStatus(String templateId) {
        PromptTemplateEntity entity = selectById(templateId);
        long now = Times.nowMillis();
        String status = "published".equals(entity.getStatus()) ? "disabled" : "published";
        entity.setStatus(status).setUpdatedAt(now);
        if ("published".equals(status)) {
            entity.setPublishedAt(now);
        }
        mapper.update(entity);
        invalidateTemplateCache();
        return toResponse(entity, true, true);
    }

    @Override
    public PromptAssembly assemblePrompt(String userId, String templateId, TemplateInputs inputs, String additionalPrompt, PromptAssemblyContext context) {
        PromptTemplateEntity entity = findTemplateForUser(userId, templateId);
        if (!"published".equals(entity.getStatus())) {
            throw ApiException.badRequest("模板不可用");
        }
        List<PromptTemplateFieldResponse> fields = decodeFields(entity.getFieldSchemaJson());
        Map<String, Object> normalized = validateInputs(fields, inputs);
        String rendered = renderTemplate(entity.getPromptBody(), normalized);
        List<String> parts = new ArrayList<>();
        parts.add(rendered.trim());
        if (entity.getNegativePrompt() != null && !entity.getNegativePrompt().isBlank()) {
            parts.add("负面约束：" + entity.getNegativePrompt().trim());
        }
        if (context != null && context.hasInputImages()) {
            parts.add(context.hasMask() ? "参考图说明：输入图片用于主体、风格或构图参考；遮罩区域是需要重点编辑的区域。" : "参考图说明：输入图片用于主体、风格或构图参考。");
        }
        String extra = additionalPrompt == null ? "" : additionalPrompt.trim();
        if (!extra.isEmpty()) {
            parts.add("补充要求：" + extra);
        }
        parts.add(SAFETY_CONSTRAINT);
        return new PromptAssembly(
            buildDisplayPrompt(entity.getTitle(), fields, normalized, extra),
            String.join("\n\n", parts),
            toResponse(entity, shouldExpose(userId, entity, false), true),
            new TemplateInputs(normalized)
        );
    }

    @Override
    public ResolvedResolutionOption resolveResolution(String userId, String templateId, String templateResolutionId) {
        PromptTemplateEntity entity = findTemplateForUser(userId, templateId);
        if (!"published".equals(entity.getStatus())) {
            throw ApiException.badRequest("模板不可用");
        }
        List<PromptTemplateResolutionOptionResponse> options = decodeResolutionOptions(entity.getResolutionOptionsJson());
        if (options.isEmpty()) {
            return null;
        }
        String requestedId = trim(templateResolutionId);
        PromptTemplateResolutionOptionResponse selected = requestedId.isEmpty()
            ? options.get(0)
            : options.stream()
                .filter(option -> Objects.equals(option.id(), requestedId))
                .findFirst()
                .orElseThrow(() -> ApiException.badRequest("分辨率档位无效"));
        return new ResolvedResolutionOption(
            selected.id(),
            selected.name(),
            selected.size()
        );
    }

    @Override
    public ResolvedQualityOption resolveQuality(String userId, String templateId, String templateQualityId) {
        PromptTemplateEntity entity = findTemplateForUser(userId, templateId);
        if (!"published".equals(entity.getStatus())) {
            throw ApiException.badRequest("模板不可用");
        }
        int fallbackCreditCost = normalizeCreditCost(entity.getCreditCost());
        List<PromptTemplateQualityOptionResponse> options = decodeQualityOptions(
            entity.getQualityOptionsJson(),
            entity.getResolutionOptionsJson(),
            fallbackCreditCost
        );
        String requestedId = trim(templateQualityId);
        PromptTemplateQualityOptionResponse selected = requestedId.isEmpty()
            ? options.get(0)
            : options.stream()
                .filter(option -> Objects.equals(option.id(), requestedId))
                .findFirst()
                .orElseThrow(() -> ApiException.badRequest("质量档位无效"));
        return new ResolvedQualityOption(
            selected.id(),
            selected.name(),
            decodeQuality(selected.quality()),
            selected.creditCost() == null ? fallbackCreditCost : normalizeCreditCost(selected.creditCost())
        );
    }

    private Map<String, Object> validateInputs(List<PromptTemplateFieldResponse> fields, TemplateInputs inputs) {
        Map<String, Object> input = inputs == null ? Map.of() : inputs.values();
        Map<String, PromptTemplateFieldResponse> byKey = new HashMap<>();
        for (PromptTemplateFieldResponse field : fields == null ? List.<PromptTemplateFieldResponse>of() : fields) {
            byKey.put(field.key(), field);
        }
        for (String key : input.keySet()) {
            if (!byKey.containsKey(key)) {
                throw ApiException.badRequest("未知字段：" + key);
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        for (PromptTemplateFieldResponse field : fields == null ? List.<PromptTemplateFieldResponse>of() : fields) {
            Object value = input.get(field.key());
            if (isEmpty(value)) {
                value = !isEmpty(field.defaultValue()) ? field.defaultValue() : "";
                if (Boolean.TRUE.equals(field.required()) && isEmpty(value)) {
                    throw ApiException.badRequest("请填写" + fieldLabel(field));
                }
            }
            result.put(field.key(), normalizeValue(field, value));
        }
        return result;
    }

    private String renderTemplate(String promptBody, Map<String, Object> inputs) {
        Matcher matcher = PLACEHOLDER.matcher(promptBody == null ? "" : promptBody);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            String key = matcher.group(1).trim();
            if (!inputs.containsKey(key)) {
                throw ApiException.badRequest("缺少字段：" + key);
            }
            matcher.appendReplacement(out, Matcher.quoteReplacement(valueToString(inputs.get(key))));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    @Override
    public void validateTemplatePreview(String promptBody, List<PromptTemplateFieldResponse> fields) {
        validateFields(promptBody == null ? "" : promptBody.trim(), fields);
    }

    @Override
    public String previewPrompt(TemplateRequests.PreviewTemplateRequest request) {
        validateTemplatePreview(request.promptBody(), request.fieldSchema());
        Map<String, Object> inputs = validateInputs(request.fieldSchema(), request.templateInputs());
        String assembled = renderTemplate(request.promptBody(), inputs);
        if (request.negativePrompt() != null && !request.negativePrompt().isBlank()) {
            assembled += "\n\n负面约束：" + request.negativePrompt();
        }
        if (request.additionalPrompt() != null && !request.additionalPrompt().isBlank()) {
            assembled += "\n\n补充要求：" + request.additionalPrompt();
        }
        return assembled + "\n\n" + SAFETY_CONSTRAINT;
    }

    private PromptTemplateEntity findTemplateForUser(String userId, String templateId) {
        PromptTemplateEntity entity = mapper.selectOneByQuery(FlexQuery.where(
            "id = ? AND (((source = ? AND status = ? AND visibility = ?) OR (source = ? AND owner_user_id = ? AND status != ?)))",
            templateId, "admin", "published", "public", "user", userId, "archived"
        ));
        if (entity == null) {
            throw ApiException.notFound("模板不存在");
        }
        return entity;
    }

    private PromptTemplateEntity selectById(String id) {
        PromptTemplateEntity entity = mapper.selectOneById(id);
        if (entity == null) {
            throw ApiException.badRequest("模板不存在");
        }
        return entity;
    }

    private String templateCacheKey(String scope, String... parts) {
        StringBuilder sb = new StringBuilder().append(templateCacheEpoch.get()).append(':').append(scope);
        for (String part : parts) {
            sb.append(':').append(part);
        }
        return sb.toString();
    }

    private void invalidateTemplateCache() {
        templateCacheEpoch.incrementAndGet();
    }

    private NormalizedTemplate normalize(TemplateRequests.PromptTemplateRequest request, boolean admin, String visibility, String status) {
        String title = trim(request.title());
        String category = trim(request.category());
        String promptBody = trim(request.promptBody());
        if (title.isEmpty()) {
            throw ApiException.badRequest("请输入模板名称");
        }
        if (category.isEmpty()) {
            throw ApiException.badRequest("请输入模板分类");
        }
        if (promptBody.isEmpty()) {
            throw ApiException.badRequest("请输入模板提示词");
        }
        String normalizedStatus = normalizeStatus(status, admin);
        String normalizedVisibility = normalizeVisibility(visibility, admin);
        String assemblyMode = normalizeAssemblyMode(request.assemblyMode());
        int creditCost = normalizeCreditCost(request.creditCost());
        validateFields(promptBody, request.fieldSchema());
        List<PromptTemplateResolutionOptionResponse> resolutionOptions = admin
            ? normalizeResolutionOptions(request.resolutionOptions())
            : List.of();
        List<PromptTemplateQualityOptionResponse> qualityOptions = admin
            ? normalizeQualityOptions(request.qualityOptions(), creditCost)
            : List.of();
        return new NormalizedTemplate(
            title,
            category,
            trim(request.description()),
            request.fieldSchema() == null ? List.of() : request.fieldSchema(),
            resolutionOptions,
            qualityOptions,
            emptyToNull(request.previewImageId()),
            promptBody,
            trim(request.negativePrompt()),
            creditCost,
            assemblyMode,
            normalizedStatus,
            normalizedVisibility,
            request.sortOrder() == null ? 0 : request.sortOrder()
        );
    }

    private PromptTemplateEntity baseEntity(NormalizedTemplate input, long now) {
        return new PromptTemplateEntity()
            .setTitle(input.title())
            .setCategory(input.category())
            .setDescription(input.description())
            .setFieldSchemaJson(JsonUtils.stringify(input.fields()))
            .setResolutionOptionsJson(JsonUtils.stringify(input.resolutionOptions()))
            .setQualityOptionsJson(JsonUtils.stringify(input.qualityOptions()))
            .setPreviewImageId(input.previewImageId())
            .setPromptBody(input.promptBody())
            .setNegativePrompt(input.negativePrompt())
            .setCreditCost(input.creditCost())
            .setAssemblyMode(input.assemblyMode())
            .setStatus(input.status())
            .setSortOrder(input.sortOrder())
            .setUpdatedAt(now)
            .setPublishedAt("published".equals(input.status()) ? now : null);
    }

    private void apply(PromptTemplateEntity entity, NormalizedTemplate input) {
        long now = Times.nowMillis();
        entity.setVisibility(input.visibility())
            .setTitle(input.title())
            .setCategory(input.category())
            .setDescription(input.description())
            .setFieldSchemaJson(JsonUtils.stringify(input.fields()))
            .setResolutionOptionsJson(JsonUtils.stringify(input.resolutionOptions()))
            .setQualityOptionsJson(JsonUtils.stringify(input.qualityOptions()))
            .setPreviewImageId(input.previewImageId())
            .setPromptBody(input.promptBody())
            .setNegativePrompt(input.negativePrompt())
            .setCreditCost(input.creditCost())
            .setAssemblyMode(input.assemblyMode())
            .setStatus(input.status())
            .setSortOrder(input.sortOrder())
            .setUpdatedAt(now);
        if ("published".equals(input.status()) && entity.getPublishedAt() == null) {
            entity.setPublishedAt(now);
        }
    }

    private void validateFields(String promptBody, List<PromptTemplateFieldResponse> fields) {
        List<String> placeholders = extractPlaceholders(promptBody);
        Map<String, PromptTemplateFieldResponse> byKey = new HashMap<>();
        for (PromptTemplateFieldResponse field : fields == null ? List.<PromptTemplateFieldResponse>of() : fields) {
            String key = trim(field.key());
            if (key.isEmpty()) {
                throw ApiException.badRequest("字段 key 不能为空");
            }
            if (byKey.containsKey(key)) {
                throw ApiException.badRequest("字段重复：" + key);
            }
            if (!isValidFieldType(field.type())) {
                throw ApiException.badRequest("字段 %s 类型无效".formatted(fieldLabel(field)));
            }
            if (field.maxLength() != null && field.maxLength() < 0) {
                throw ApiException.badRequest("字段 %s 长度限制无效".formatted(fieldLabel(field)));
            }
            byKey.put(key, field);
        }
        for (String tag : placeholders) {
            if (!byKey.containsKey(tag)) {
                throw ApiException.badRequest("占位符 {%s} 缺少字段配置".formatted(tag));
            }
        }
        for (String key : byKey.keySet()) {
            if (!placeholders.contains(key)) {
                throw ApiException.badRequest("字段 %s 未在模板中使用".formatted(key));
            }
        }
    }

    private List<String> extractPlaceholders(String promptBody) {
        List<String> tags = new ArrayList<>();
        Matcher matcher = PLACEHOLDER.matcher(promptBody == null ? "" : promptBody);
        while (matcher.find()) {
            String tag = matcher.group(1).trim();
            if (tag.isEmpty()) {
                throw ApiException.badRequest("占位符不能为空");
            }
            if (!tags.contains(tag)) {
                tags.add(tag);
            }
        }
        tags.sort(String::compareTo);
        return tags;
    }

    private Object normalizeValue(PromptTemplateFieldResponse field, Object value) {
        String type = normalizeFieldType(field.type());
        return switch (type) {
            case "number" -> normalizeNumber(field, value);
            case "boolean" -> normalizeBoolean(field, value);
            case "multi_select" -> normalizeMultiSelect(field, value);
            case "select" -> validateText(field, valueToString(value).trim());
            default -> validateText(field, valueToString(value).trim());
        };
    }

    private Object normalizeNumber(PromptTemplateFieldResponse field, Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        if (value instanceof String text && !text.trim().isEmpty()) {
            try {
                return Double.parseDouble(text.trim());
            } catch (NumberFormatException e) {
                throw ApiException.badRequest(fieldLabel(field) + " 必须是数字");
            }
        }
        return "";
    }

    private Object normalizeBoolean(PromptTemplateFieldResponse field, Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value instanceof String text) {
            if (text.trim().isEmpty()) {
                return false;
            }
            if ("true".equalsIgnoreCase(text.trim()) || "false".equalsIgnoreCase(text.trim())) {
                return Boolean.parseBoolean(text.trim());
            }
        }
        throw ApiException.badRequest(fieldLabel(field) + " 必须是真/假");
    }

    private List<String> normalizeMultiSelect(PromptTemplateFieldResponse field, Object value) {
        List<String> values = new ArrayList<>();
        if (value instanceof List<?> list) {
            for (Object item : list) {
                String text = valueToString(item).trim();
                if (!text.isEmpty()) {
                    values.add(text);
                }
            }
        } else if (value instanceof String text && !text.trim().isEmpty()) {
            values.add(text.trim());
        } else if (!isEmpty(value)) {
            throw ApiException.badRequest(fieldLabel(field) + " 格式无效");
        }
        validateOptions(field, values);
        return values;
    }

    private String validateText(PromptTemplateFieldResponse field, String text) {
        validateOptions(field, List.of(text));
        int maxLength = field.maxLength() == null || field.maxLength() <= 0 ? ("long_text".equals(normalizeFieldType(field.type())) ? 1000 : 200) : field.maxLength();
        if (text.codePointCount(0, text.length()) > maxLength) {
            throw ApiException.badRequest("%s 最多 %d 个字符".formatted(fieldLabel(field), maxLength));
        }
        return text;
    }

    private void validateOptions(PromptTemplateFieldResponse field, List<String> values) {
        if (field.options() == null || field.options().isEmpty()) {
            return;
        }
        boolean allowCustom = "select".equals(normalizeFieldType(field.type()))
            && (Boolean.TRUE.equals(field.allowCustom()) || field.options().contains("自定义"));
        for (String value : values) {
            if (!value.isEmpty() && !field.options().contains(value) && !allowCustom) {
                throw ApiException.badRequest("%s 选项无效：%s".formatted(fieldLabel(field), value));
            }
        }
    }

    private String buildDisplayPrompt(String title, List<PromptTemplateFieldResponse> fields, Map<String, Object> inputs, String additionalPrompt) {
        List<String> values = new ArrayList<>();
        for (PromptTemplateFieldResponse field : fields) {
            String value = valueToString(inputs.get(field.key())).trim();
            if (!value.isEmpty()) {
                values.add(value);
            }
            if (values.size() >= 3) {
                break;
            }
        }
        String prefix = title == null || title.isBlank() ? "旅行模板" : title.trim();
        if (values.isEmpty()) {
            String extra = trim(additionalPrompt);
            return extra.isEmpty() ? prefix : prefix + " · " + abbreviate(extra, 60);
        }
        return prefix + " · " + String.join(" · ", values);
    }

    private PromptTemplateResponse toResponse(PromptTemplateEntity entity, boolean exposePromptBody, boolean exposeResolutionSize) {
        return new PromptTemplateResponse(
            entity.getId(),
            nullToEmpty(entity.getOwnerUserId()),
            entity.getSource(),
            entity.getVisibility(),
            entity.getTitle(),
            entity.getCategory(),
            entity.getDescription(),
            decodeFields(entity.getFieldSchemaJson()),
            resolutionOptionsForResponse(entity.getResolutionOptionsJson(), exposeResolutionSize),
            qualityOptionsForResponse(entity.getQualityOptionsJson(), entity.getResolutionOptionsJson(), normalizeCreditCost(entity.getCreditCost())),
            nullToEmpty(entity.getPreviewImageId()),
            exposePromptBody ? entity.getPromptBody() : null,
            exposePromptBody ? entity.getNegativePrompt() : null,
            normalizeCreditCost(entity.getCreditCost()),
            entity.getAssemblyMode(),
            entity.getStatus(),
            nullToZero(entity.getSortOrder()),
            nullToZero(entity.getVersion()),
            entity.getCreatedAt() == null ? 0L : entity.getCreatedAt(),
            entity.getUpdatedAt() == null ? 0L : entity.getUpdatedAt(),
            entity.getPublishedAt()
        );
    }

    private List<PromptTemplateFieldResponse> decodeFields(String json) {
        try {
            List<PromptTemplateFieldResponse> fields = JsonUtils.mapper().readValue(json == null ? "[]" : json, new TypeReference<List<PromptTemplateFieldResponse>>() {});
            return fields == null ? List.of() : fields;
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<PromptTemplateResolutionOptionResponse> normalizeResolutionOptions(List<PromptTemplateResolutionOptionResponse> options) {
        if (options == null || options.isEmpty()) {
            return List.of();
        }
        List<PromptTemplateResolutionOptionResponse> result = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        for (PromptTemplateResolutionOptionResponse option : options) {
            if (option == null) {
                continue;
            }
            String name = trim(option.name());
            String rawSize = trim(option.size());
            if (name.isEmpty() && rawSize.isEmpty()) {
                continue;
            }
            if (name.isEmpty()) {
                throw ApiException.badRequest("分辨率名称不能为空");
            }
            if (name.codePointCount(0, name.length()) > 100) {
                throw ApiException.badRequest("分辨率名称最多 100 个字符");
            }
            String size;
            if (rawSize.isEmpty()) {
                size = ImageSizeUtils.POOL_AUTO;
            } else {
                try {
                    size = ImageSizeUtils.normalizeImageSize(rawSize);
                } catch (IllegalArgumentException e) {
                    throw ApiException.badRequest("真实尺寸参数无效");
                }
            }
            String id = trim(option.id());
            if (id.isEmpty()) {
                id = Ids.generate();
            }
            if (id.length() > 64) {
                throw ApiException.badRequest("分辨率档位 ID 无效");
            }
            if (!ids.add(id)) {
                throw ApiException.badRequest("分辨率档位 ID 重复");
            }
            result.add(new PromptTemplateResolutionOptionResponse(id, name, size));
        }
        return result;
    }

    private List<PromptTemplateQualityOptionResponse> normalizeQualityOptions(List<PromptTemplateQualityOptionResponse> options, int fallbackCreditCost) {
        Map<String, Integer> creditCostByQuality = new LinkedHashMap<>();
        for (PromptTemplateQualityOptionResponse option : options == null ? List.<PromptTemplateQualityOptionResponse>of() : options) {
            if (option == null) {
                continue;
            }
            String quality = normalizeQuality(option.quality());
            creditCostByQuality.put(quality, option.creditCost() == null ? fallbackCreditCost : normalizeCreditCost(option.creditCost()));
        }
        return fixedQualityOptions(creditCostByQuality, fallbackCreditCost);
    }

    private List<PromptTemplateResolutionOptionResponse> decodeResolutionOptions(String json) {
        List<OptionNode> nodes = decodeOptionNodes(json);
        if (nodes.isEmpty()) {
            return List.of();
        }
        List<PromptTemplateResolutionOptionResponse> result = new ArrayList<>();
        for (OptionNode option : nodes) {
            String id = trim(option.id());
            String name = trim(option.name());
            String rawSize = trim(option.size());
            String rawQuality = trim(option.quality());
            if (id.isEmpty() || name.isEmpty()) {
                continue;
            }
            // 兼容上一版误把“质量”存在 resolutionOptions 的数据：只有质量、没有真实尺寸时，不再当作分辨率展示。
            if (!rawQuality.isEmpty() && (rawSize.isEmpty() || ImageSizeUtils.POOL_AUTO.equalsIgnoreCase(rawSize))) {
                continue;
            }
            String size;
            try {
                size = rawSize.isEmpty() ? ImageSizeUtils.POOL_AUTO : ImageSizeUtils.normalizeImageSize(rawSize);
            } catch (IllegalArgumentException e) {
                size = ImageSizeUtils.POOL_AUTO;
            }
            result.add(new PromptTemplateResolutionOptionResponse(id, name, size));
        }
        return result;
    }

    private List<PromptTemplateQualityOptionResponse> decodeQualityOptions(String json, String legacyResolutionJson, int fallbackCreditCost) {
        List<PromptTemplateQualityOptionResponse> configured = decodeQualityOptionNodes(decodeOptionNodes(json), fallbackCreditCost, false);
        if (configured.isEmpty()) {
            configured = decodeQualityOptionNodes(decodeOptionNodes(legacyResolutionJson), fallbackCreditCost, true);
        }
        return fixedQualityOptions(configured, fallbackCreditCost);
    }

    private List<PromptTemplateQualityOptionResponse> decodeQualityOptionNodes(List<OptionNode> nodes, int fallbackCreditCost, boolean legacyOnlyWithQualityFields) {
        List<PromptTemplateQualityOptionResponse> result = new ArrayList<>();
        for (OptionNode option : nodes) {
            String id = trim(option.id());
            String name = trim(option.name());
            String rawQuality = trim(option.quality());
            if (id.isEmpty()) {
                continue;
            }
            if (legacyOnlyWithQualityFields && rawQuality.isEmpty()) {
                continue;
            }
            String quality = decodeQuality(rawQuality);
            if (name.isEmpty()) {
                name = qualityLabel(quality);
            }
            result.add(new PromptTemplateQualityOptionResponse(
                id,
                name,
                quality,
                option.creditCost() == null ? fallbackCreditCost : normalizeCreditCost(option.creditCost())
            ));
        }
        return result;
    }

    private List<OptionNode> decodeOptionNodes(String json) {
        try {
            JsonNode root = JsonUtils.mapper().readTree(json == null || json.isBlank() ? "[]" : json);
            if (root == null || !root.isArray()) {
                return List.of();
            }
            List<OptionNode> result = new ArrayList<>();
            for (JsonNode item : root) {
                if (item == null || item.isNull()) {
                    continue;
                }
                result.add(new OptionNode(
                    nodeText(item, "id"),
                    nodeText(item, "name"),
                    nodeText(item, "size"),
                    nodeText(item, "quality"),
                    nodeInteger(item, "creditCost")
                ));
            }
            return result;
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<PromptTemplateResolutionOptionResponse> resolutionOptionsForResponse(String json, boolean exposeSize) {
        return decodeResolutionOptions(json).stream()
            .map(option -> new PromptTemplateResolutionOptionResponse(
                option.id(),
                option.name(),
                exposeSize ? option.size() : null
            ))
            .toList();
    }

    private List<PromptTemplateQualityOptionResponse> qualityOptionsForResponse(String json, String legacyResolutionJson, int fallbackCreditCost) {
        return decodeQualityOptions(json, legacyResolutionJson, fallbackCreditCost);
    }

    private boolean shouldExpose(String userId, PromptTemplateEntity entity, boolean admin) {
        return admin || ("user".equals(entity.getSource()) && Objects.equals(entity.getOwnerUserId(), userId));
    }

    private String normalizeStatus(String status, boolean admin) {
        String value = status == null || status.isBlank() ? (admin ? "draft" : "published") : status.trim();
        if (List.of("draft", "published", "disabled", "archived").contains(value)) {
            return value;
        }
        throw ApiException.badRequest("模板状态无效");
    }

    private String normalizeVisibility(String visibility, boolean admin) {
        String value = visibility == null || visibility.isBlank() ? (admin ? "public" : "private") : visibility.trim();
        if (List.of("public", "private").contains(value)) {
            return value;
        }
        return admin ? "public" : "private";
    }

    private String normalizeAssemblyMode(String mode) {
        String value = mode == null || mode.isBlank() ? "sections" : mode.trim();
        if (!"sections".equals(value)) {
            throw ApiException.badRequest("拼接模式无效");
        }
        return value;
    }

    private int normalizeCreditCost(Integer value) {
        if (value == null) {
            return 1;
        }
        if (value < 1 || value > 1000) {
            throw ApiException.badRequest("积分消耗必须是 1 到 1000 的整数");
        }
        return value;
    }

    private List<PromptTemplateQualityOptionResponse> defaultQualityOptions(int fallbackCreditCost) {
        return fixedQualityOptions(Map.of(), fallbackCreditCost);
    }

    private List<PromptTemplateQualityOptionResponse> fixedQualityOptions(List<PromptTemplateQualityOptionResponse> options, int fallbackCreditCost) {
        Map<String, Integer> creditCostByQuality = new LinkedHashMap<>();
        for (PromptTemplateQualityOptionResponse option : options == null ? List.<PromptTemplateQualityOptionResponse>of() : options) {
            if (option == null) {
                continue;
            }
            String quality = decodeQuality(option.quality());
            creditCostByQuality.put(quality, option.creditCost() == null ? fallbackCreditCost : normalizeCreditCost(option.creditCost()));
        }
        return fixedQualityOptions(creditCostByQuality, fallbackCreditCost);
    }

    private List<PromptTemplateQualityOptionResponse> fixedQualityOptions(Map<String, Integer> creditCostByQuality, int fallbackCreditCost) {
        int normalizedFallbackCreditCost = normalizeCreditCost(fallbackCreditCost);
        return List.of(
            fixedQualityOption("auto", creditCostByQuality, normalizedFallbackCreditCost),
            fixedQualityOption("low", creditCostByQuality, normalizedFallbackCreditCost),
            fixedQualityOption("medium", creditCostByQuality, normalizedFallbackCreditCost),
            fixedQualityOption("high", creditCostByQuality, normalizedFallbackCreditCost)
        );
    }

    private PromptTemplateQualityOptionResponse fixedQualityOption(String quality, Map<String, Integer> creditCostByQuality, int fallbackCreditCost) {
        Integer creditCost = creditCostByQuality == null ? null : creditCostByQuality.get(quality);
        return new PromptTemplateQualityOptionResponse(
            "quality_" + quality,
            qualityLabel(quality),
            quality,
            creditCost == null ? fallbackCreditCost : normalizeCreditCost(creditCost)
        );
    }

    private String normalizeQuality(String quality) {
        String value = quality == null || quality.isBlank() ? "auto" : quality.trim();
        if (List.of("auto", "low", "medium", "high").contains(value)) {
            return value;
        }
        throw ApiException.badRequest("质量参数无效");
    }

    private String decodeQuality(String quality) {
        String value = quality == null || quality.isBlank() ? "auto" : quality.trim();
        return List.of("auto", "low", "medium", "high").contains(value) ? value : "auto";
    }

    private String qualityLabel(String quality) {
        return switch (decodeQuality(quality)) {
            case "low" -> "低质量";
            case "medium" -> "中质量";
            case "high" -> "高质量";
            default -> "自动";
        };
    }

    private String nodeText(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private Integer nodeInteger(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.get(field);
        if (value == null || value.isNull()) {
            return null;
        }
        if (value.isInt() || value.isLong()) {
            return value.asInt();
        }
        try {
            String text = value.asText();
            return text == null || text.isBlank() ? null : Integer.parseInt(text.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private boolean isValidFieldType(String type) {
        return List.of("short_text", "long_text", "select", "multi_select", "number", "boolean").contains(normalizeFieldType(type));
    }

    private String normalizeFieldType(String type) {
        return type == null || type.isBlank() ? "short_text" : type.trim();
    }

    private boolean isEmpty(Object value) {
        if (value == null) {
            return true;
        }
        if (value instanceof String text) {
            return text.trim().isEmpty();
        }
        if (value instanceof List<?> list) {
            return list.isEmpty();
        }
        return false;
    }

    private String valueToString(Object value) {
        if (value == null) {
            return "";
        }
        if (value instanceof Boolean bool) {
            return bool ? "是" : "否";
        }
        if (value instanceof List<?> list) {
            return list.stream().map(this::valueToString).map(String::trim).filter(s -> !s.isEmpty()).reduce((a, b) -> a + "、" + b).orElse("");
        }
        if (value instanceof Number number) {
            return number.toString();
        }
        if (value instanceof String text) {
            return text;
        }
        return JsonUtils.stringify(value);
    }

    private String fieldLabel(PromptTemplateFieldResponse field) {
        return field.label() == null || field.label().isBlank() ? field.key() : field.label();
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private String emptyToNull(String value) {
        String trimmed = trim(value);
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private int nullToZero(Integer value) {
        return value == null ? 0 : value;
    }

    private String abbreviate(String value, int maxRunes) {
        if (value.codePointCount(0, value.length()) <= maxRunes) {
            return value;
        }
        return value.substring(0, value.offsetByCodePoints(0, maxRunes)) + "...";
    }

    private record OptionNode(String id, String name, String size, String quality, Integer creditCost) {
    }

    private record NormalizedTemplate(
        String title,
        String category,
        String description,
        List<PromptTemplateFieldResponse> fields,
        List<PromptTemplateResolutionOptionResponse> resolutionOptions,
        List<PromptTemplateQualityOptionResponse> qualityOptions,
        String previewImageId,
        String promptBody,
        String negativePrompt,
        int creditCost,
        String assemblyMode,
        String status,
        String visibility,
        int sortOrder
    ) {
    }
}
