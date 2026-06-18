package com.tripcanvas.backend.dto.response;

public final class AnalyticsResponses {
    public static final long MONEY_SCALE = 10000L;

    private AnalyticsResponses() {
    }

    public record AnalyticsMeta(String range, long from, long to, long moneyScale) {
    }

    public record BillingSummary(long revenueX10000, long costX10000, long profitX10000, int successImages) {
    }

    public record BillingTrendPoint(String bucket, long revenueX10000, long costX10000, long profitX10000, int successImages) {
    }

    public record BillingEndpointRow(String endpointBaseUrl, String endpointLabel, int successImages, long revenueX10000, long costX10000, long profitX10000, long profitRateBps) {
    }

    public record BillingUserRow(String userId, String userLabel, int successImages, long revenueX10000, long costX10000, long profitX10000, long profitRateBps) {
    }

    public record ImageSizeRow(String imageSize, int successImages, long revenueX10000, long costX10000, long profitX10000) {
    }

    public record EndpointSizeCell(int successImages, long costX10000) {
    }

    public record EndpointSizeBreakdownRow(
        String endpointBaseUrl,
        String endpointLabel,
        EndpointSizeCell size1K,
        EndpointSizeCell size2K,
        EndpointSizeCell size4K,
        EndpointSizeCell unknown
    ) {
    }
}
