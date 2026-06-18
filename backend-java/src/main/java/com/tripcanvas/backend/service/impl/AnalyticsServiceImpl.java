package com.tripcanvas.backend.service.impl;

import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.dto.response.AnalyticsResponses;
import com.tripcanvas.backend.service.AnalyticsService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AnalyticsServiceImpl implements AnalyticsService {
    private final JdbcTemplate jdbcTemplate;

    @Override
    public AnalyticsRange parseRange(String value, Instant now) {
        String label = value == null || value.isBlank() ? "7d" : value.trim();
        if (!List.of("today", "7d", "30d", "all").contains(label)) {
            throw ApiException.badRequest("unsupported range: %q".formatted(label));
        }
        Instant nowUtc = now == null ? Instant.now() : now;
        long to = nowUtc.toEpochMilli();
        long from = switch (label) {
            case "today" -> LocalDate.ofInstant(nowUtc, ZoneOffset.UTC).atStartOfDay().toInstant(ZoneOffset.UTC).toEpochMilli();
            case "30d" -> nowUtc.minus(30, ChronoUnit.DAYS).toEpochMilli();
            case "all" -> 0L;
            default -> nowUtc.minus(7, ChronoUnit.DAYS).toEpochMilli();
        };
        return new AnalyticsRange(label, from, to);
    }

    @Override
    public AnalyticsResponses.AnalyticsMeta meta(AnalyticsRange range) {
        return new AnalyticsResponses.AnalyticsMeta(range.label(), range.from(), range.to(), AnalyticsResponses.MONEY_SCALE);
    }

    @Override
    public AnalyticsResponses.BillingSummary summary(AnalyticsRange range) {
        return jdbcTemplate.queryForObject(
            "SELECT COALESCE(SUM(revenue_x10000),0), COALESCE(SUM(cost_x10000),0), COALESCE(SUM(profit_x10000),0), COALESCE(SUM(success_image_count),0) FROM billing_records WHERE created_at >= ? AND created_at <= ?",
            (rs, rowNum) -> new AnalyticsResponses.BillingSummary(rs.getLong(1), rs.getLong(2), rs.getLong(3), rs.getInt(4)),
            range.from(), range.to()
        );
    }

    @Override
    public List<AnalyticsResponses.BillingTrendPoint> trend(AnalyticsRange range) {
        return jdbcTemplate.query(
            "SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS bucket, COALESCE(SUM(revenue_x10000),0), COALESCE(SUM(cost_x10000),0), COALESCE(SUM(profit_x10000),0), COALESCE(SUM(success_image_count),0) FROM billing_records WHERE created_at >= ? AND created_at <= ? GROUP BY bucket ORDER BY bucket ASC",
            (rs, rowNum) -> new AnalyticsResponses.BillingTrendPoint(rs.getString(1), rs.getLong(2), rs.getLong(3), rs.getLong(4), rs.getInt(5)),
            range.from(), range.to()
        );
    }

    @Override
    public List<AnalyticsResponses.BillingEndpointRow> endpointBreakdown(AnalyticsRange range) {
        return jdbcTemplate.query(
            "SELECT endpoint_base_url_snapshot, COALESCE(SUM(revenue_x10000),0), COALESCE(SUM(cost_x10000),0), COALESCE(SUM(profit_x10000),0), COALESCE(SUM(success_image_count),0) FROM billing_records WHERE created_at >= ? AND created_at <= ? GROUP BY endpoint_base_url_snapshot ORDER BY 4 DESC, 2 DESC",
            (rs, rowNum) -> new AnalyticsResponses.BillingEndpointRow(rs.getString(1), rs.getString(1), rs.getInt(5), rs.getLong(2), rs.getLong(3), rs.getLong(4), profitRateBps(rs.getLong(4), rs.getLong(2))),
            range.from(), range.to()
        );
    }

    @Override
    public List<AnalyticsResponses.BillingUserRow> userBreakdown(AnalyticsRange range) {
        return jdbcTemplate.query(
            "SELECT user_id, user_label_snapshot, COALESCE(SUM(revenue_x10000),0), COALESCE(SUM(cost_x10000),0), COALESCE(SUM(profit_x10000),0), COALESCE(SUM(success_image_count),0) FROM billing_records WHERE created_at >= ? AND created_at <= ? GROUP BY user_id, user_label_snapshot ORDER BY 5 DESC, 3 DESC",
            (rs, rowNum) -> new AnalyticsResponses.BillingUserRow(rs.getString(1), rs.getString(2), rs.getInt(6), rs.getLong(3), rs.getLong(4), rs.getLong(5), profitRateBps(rs.getLong(5), rs.getLong(3))),
            range.from(), range.to()
        );
    }

    @Override
    public List<AnalyticsResponses.ImageSizeRow> imageSizeBreakdown(AnalyticsRange range) {
        return jdbcTemplate.query(
            "SELECT image_size, COALESCE(SUM(revenue_x10000),0), COALESCE(SUM(cost_x10000),0), COALESCE(SUM(profit_x10000),0), COALESCE(SUM(success_image_count),0) FROM billing_records WHERE created_at >= ? AND created_at <= ? GROUP BY image_size ORDER BY 5 DESC, 3 DESC",
            (rs, rowNum) -> new AnalyticsResponses.ImageSizeRow(rs.getString(1), rs.getInt(5), rs.getLong(2), rs.getLong(3), rs.getLong(4)),
            range.from(), range.to()
        );
    }

    @Override
    public List<AnalyticsResponses.EndpointSizeBreakdownRow> endpointSizeBreakdown(AnalyticsRange range) {
        List<EndpointSizeRow> rows = jdbcTemplate.query(
            "SELECT endpoint_base_url_snapshot, image_size, COALESCE(SUM(cost_x10000),0), COALESCE(SUM(success_image_count),0) FROM billing_records WHERE created_at >= ? AND created_at <= ? GROUP BY endpoint_base_url_snapshot, image_size",
            (rs, rowNum) -> new EndpointSizeRow(rs.getString(1), rs.getString(2), rs.getLong(3), rs.getInt(4)),
            range.from(), range.to()
        );
        Map<String, MutableEndpointSize> byEndpoint = new HashMap<>();
        for (EndpointSizeRow row : rows) {
            MutableEndpointSize entry = byEndpoint.computeIfAbsent(row.endpoint(), MutableEndpointSize::new);
            AnalyticsResponses.EndpointSizeCell cell = new AnalyticsResponses.EndpointSizeCell(row.successImages(), row.cost());
            switch (row.size()) {
                case "1K" -> entry.size1K = cell;
                case "2K" -> entry.size2K = cell;
                case "4K" -> entry.size4K = cell;
                default -> entry.unknown = new AnalyticsResponses.EndpointSizeCell(entry.unknown.successImages() + row.successImages(), entry.unknown.costX10000() + row.cost());
            }
        }
        List<AnalyticsResponses.EndpointSizeBreakdownRow> result = new ArrayList<>();
        for (MutableEndpointSize value : byEndpoint.values()) {
            result.add(value.toResponse());
        }
        result.sort(Comparator.comparingLong(this::totalCost).reversed());
        return result;
    }

    @Override
    public long clear() {
        return jdbcTemplate.update("DELETE FROM billing_records");
    }

    private long profitRateBps(long profit, long revenue) {
        if (revenue <= 0) {
            return 0L;
        }
        return profit * 10000L / revenue;
    }

    private long totalCost(AnalyticsResponses.EndpointSizeBreakdownRow row) {
        return row.size1K().costX10000() + row.size2K().costX10000() + row.size4K().costX10000() + row.unknown().costX10000();
    }

    private record EndpointSizeRow(String endpoint, String size, long cost, int successImages) {
    }

    private static final class MutableEndpointSize {
        private static final AnalyticsResponses.EndpointSizeCell ZERO = new AnalyticsResponses.EndpointSizeCell(0, 0L);
        private final String endpoint;
        private AnalyticsResponses.EndpointSizeCell size1K = ZERO;
        private AnalyticsResponses.EndpointSizeCell size2K = ZERO;
        private AnalyticsResponses.EndpointSizeCell size4K = ZERO;
        private AnalyticsResponses.EndpointSizeCell unknown = ZERO;

        private MutableEndpointSize(String endpoint) {
            this.endpoint = endpoint;
        }

        private AnalyticsResponses.EndpointSizeBreakdownRow toResponse() {
            return new AnalyticsResponses.EndpointSizeBreakdownRow(endpoint, endpoint, size1K, size2K, size4K, unknown);
        }
    }
}
