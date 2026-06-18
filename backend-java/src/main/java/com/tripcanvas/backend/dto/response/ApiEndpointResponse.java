package com.tripcanvas.backend.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ApiEndpointResponse(
    @NotBlank(message = "端点 baseUrl 不能为空") String baseUrl,
    @NotBlank(message = "端点 apiKey 不能为空") String apiKey,
    @Min(value = 0, message = "端点并发数不能小于 0") Integer maxConcurrency,
    @Min(value = 0, message = "端点优先级不能小于 0") Integer priority,
    @Min(value = 0, message = "端点成本价不能小于 0") Long costPerImageX10000,
    @Min(value = 0, message = "1K 成本价不能小于 0") Long cost1KX10000,
    @Min(value = 0, message = "2K 成本价不能小于 0") Long cost2KX10000,
    @Min(value = 0, message = "4K 成本价不能小于 0") Long cost4KX10000,
    @JsonIgnore String runtimePool
) {
    public ApiEndpointResponse withRuntimePool(String pool) {
        return new ApiEndpointResponse(baseUrl, apiKey, maxConcurrency, priority, costPerImageX10000, cost1KX10000, cost2KX10000, cost4KX10000, pool);
    }
}
