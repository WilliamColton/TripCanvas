package com.tripcanvas.backend.dto.response;

import com.tripcanvas.backend.service.AppConfigService;
import java.util.List;

public final class ApiPayloads {
    private ApiPayloads() {
    }

    public record AuthLogin(String token, AuthUserResponse user, boolean needsMigration) {
    }

    public record Token(String token) {
    }

    public record User(AuthUserResponse user) {
    }

    public record InviteCode(String code, Long setAt) {
    }

    public record InvitedUsers(List<InviteResponses.InvitedUserRow> invitedUsers) {
    }

    public record Tasks(List<TaskRecordResponse> tasks) {
    }

    public record ImageUpload(String id, String url, long createdAt, String source) {
    }

    public record GenerateSubmit(String taskId, String status) {
    }

    public record Templates(List<PromptTemplateResponse> templates) {
    }

    public record Template(PromptTemplateResponse template) {
    }

    public record Prompt(String prompt) {
    }

    public record PreviewImage(String id, String url, long createdAt) {
    }

    public record Feedback(FeedbackResponse feedback) {
    }

    public record Feedbacks(List<FeedbackResponse> feedbacks) {
    }

    public record Changelog(ChangelogEntryResponse changelog) {
    }

    public record Changelogs(List<ChangelogEntryResponse> changelogs) {
    }

    public record Users(List<AdminUserResponse> users) {
    }

    public record Codes(List<RedemptionCodeResponse> codes) {
    }

    public record Deleted(boolean ok, long deleted) {
        public Deleted(long deleted) {
            this(true, deleted);
        }
    }

    public record EndpointPools(
        List<ApiEndpointResponse> endpointsAuto,
        List<ApiEndpointResponse> endpoints1K,
        List<ApiEndpointResponse> endpoints2K,
        List<ApiEndpointResponse> endpoints4K,
        boolean ok
    ) {
        public EndpointPools(
            List<ApiEndpointResponse> endpointsAuto,
            List<ApiEndpointResponse> endpoints1K,
            List<ApiEndpointResponse> endpoints2K,
            List<ApiEndpointResponse> endpoints4K
        ) {
            this(endpointsAuto, endpoints1K, endpoints2K, endpoints4K, true);
        }
    }

    public record InviteConfig(
        int inviterReward,
        int inviteeReward,
        int defaultQuota,
        boolean inviteEnabled,
        boolean ok
    ) {
        public InviteConfig(int inviterReward, int inviteeReward, int defaultQuota, boolean inviteEnabled) {
            this(inviterReward, inviteeReward, defaultQuota, inviteEnabled, true);
        }

        public static InviteConfig from(AppConfigService.InviteConfig source) {
            return new InviteConfig(source.inviterReward(), source.inviteeReward(), source.defaultQuota(), source.inviteEnabled());
        }
    }

    public record AnalyticsSummary(AnalyticsResponses.AnalyticsMeta meta, AnalyticsResponses.BillingSummary summary) {
    }

    public record AnalyticsTrend(AnalyticsResponses.AnalyticsMeta meta, List<AnalyticsResponses.BillingTrendPoint> trend) {
    }

    public record AnalyticsRows<T>(AnalyticsResponses.AnalyticsMeta meta, List<T> rows) {
    }
}
