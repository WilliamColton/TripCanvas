package com.tripcanvas.backend.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.LinkedHashMap;
import java.util.Map;

public record TemplateInputs(Map<String, Object> values) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public TemplateInputs {
        values = values == null ? new LinkedHashMap<>() : new LinkedHashMap<>(values);
    }

    @JsonValue
    public Map<String, Object> asJson() {
        return values;
    }

    public static TemplateInputs empty() {
        return new TemplateInputs(null);
    }
}
