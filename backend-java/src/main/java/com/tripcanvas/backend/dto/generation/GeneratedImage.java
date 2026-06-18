package com.tripcanvas.backend.dto.generation;

import com.tripcanvas.backend.dto.response.TaskParamsResponse;

public record GeneratedImage(
    String base64,
    TaskParamsResponse actualParams,
    String revisedPrompt,
    String endpointBaseUrl,
    String sizeTier,
    long unitCostX10000,
    long endpointCost1KX10000,
    long endpointCost2KX10000,
    long endpointCost4KX10000
) {
    public GeneratedImage withEndpoint(String baseUrl, long cost1K, long cost2K, long cost4K) {
        return new GeneratedImage(base64, actualParams, revisedPrompt, baseUrl, sizeTier, costForTier(sizeTier, cost1K, cost2K, cost4K), cost1K, cost2K, cost4K);
    }

    public GeneratedImage withSizeTier(String tier) {
        return new GeneratedImage(base64, actualParams, revisedPrompt, endpointBaseUrl, tier, costForTier(tier, endpointCost1KX10000, endpointCost2KX10000, endpointCost4KX10000), endpointCost1KX10000, endpointCost2KX10000, endpointCost4KX10000);
    }

    public static long costForTier(String tier, long cost1K, long cost2K, long cost4K) {
        return switch (tier == null ? "" : tier) {
            case "1K" -> cost1K;
            case "2K" -> cost2K;
            case "4K" -> cost4K;
            default -> 0L;
        };
    }
}
