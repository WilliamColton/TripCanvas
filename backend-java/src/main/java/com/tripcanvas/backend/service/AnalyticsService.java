package com.tripcanvas.backend.service;

import com.tripcanvas.backend.dto.response.AnalyticsResponses;
import java.time.Instant;
import java.util.List;

public interface AnalyticsService {
    AnalyticsRange parseRange(String value, Instant now);

    AnalyticsResponses.BillingSummary summary(AnalyticsRange range);

    List<AnalyticsResponses.BillingTrendPoint> trend(AnalyticsRange range);

    List<AnalyticsResponses.BillingEndpointRow> endpointBreakdown(AnalyticsRange range);

    List<AnalyticsResponses.BillingUserRow> userBreakdown(AnalyticsRange range);

    List<AnalyticsResponses.ImageSizeRow> imageSizeBreakdown(AnalyticsRange range);

    List<AnalyticsResponses.EndpointSizeBreakdownRow> endpointSizeBreakdown(AnalyticsRange range);

    long clear();

    AnalyticsResponses.AnalyticsMeta meta(AnalyticsRange range);

    record AnalyticsRange(String label, long from, long to) {
    }
}
