package com.tripcanvas.backend.util;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripcanvas.backend.dto.response.TaskParamsResponse;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class JsonUtils {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private JsonUtils() {
    }

    public static ObjectMapper mapper() {
        return OBJECT_MAPPER;
    }

    public static String stringify(Object value) {
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (Exception e) {
            return "null";
        }
    }

    public static List<String> parseStringList(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<String> list = OBJECT_MAPPER.readValue(json, new TypeReference<List<String>>() {});
            return list == null ? new ArrayList<>() : list;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    public static Map<String, Object> parseObjectMap(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return OBJECT_MAPPER.readValue(json, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    public static TaskParamsResponse parseTaskParams(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return OBJECT_MAPPER.readValue(json, TaskParamsResponse.class);
        } catch (Exception e) {
            return null;
        }
    }

    public static Map<String, TaskParamsResponse> parseTaskParamsMap(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            Map<String, TaskParamsResponse> value = OBJECT_MAPPER.readValue(json, new TypeReference<Map<String, TaskParamsResponse>>() {});
            return value == null || value.isEmpty() ? null : value;
        } catch (Exception e) {
            return null;
        }
    }

    public static Map<String, String> parseStringMap(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            Map<String, String> value = OBJECT_MAPPER.readValue(json, new TypeReference<Map<String, String>>() {});
            return value == null || value.isEmpty() ? null : value;
        } catch (Exception e) {
            return null;
        }
    }
}
