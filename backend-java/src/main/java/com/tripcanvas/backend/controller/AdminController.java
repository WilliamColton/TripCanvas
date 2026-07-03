package com.tripcanvas.backend.controller;

import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.common.web.ApiResponse;
import com.tripcanvas.backend.dto.request.AdminRequests;
import com.tripcanvas.backend.dto.request.AnnouncementRequest;
import com.tripcanvas.backend.dto.response.AnnouncementResponse;
import com.tripcanvas.backend.dto.response.ApiPayloads;
import com.tripcanvas.backend.security.AuthContext;
import com.tripcanvas.backend.security.JwtService;
import com.tripcanvas.backend.service.AnalyticsService;
import com.tripcanvas.backend.service.AnnouncementService;
import com.tripcanvas.backend.service.AppConfigService;
import com.tripcanvas.backend.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {
    private final AuthService authService;
    private final AppConfigService appConfigService;
    private final JwtService jwtService;
    private final AnnouncementService announcementService;
    private final AnalyticsService analyticsService;

    @PostMapping("/login")
    public ApiPayloads.Token login(@Valid @RequestBody AdminRequests.AdminLoginRequest body) {
        if (!Objects.equals(body.apikey(), appConfigService.adminApikey())) {
            throw ApiException.unauthorized("管理员密钥错误");
        }
        return new ApiPayloads.Token(jwtService.signToken(authService.findActiveAdminUserId(), "admin"));
    }

    @GetMapping("/users")
    public ApiPayloads.Users users() {
        return new ApiPayloads.Users(authService.listAllUsers());
    }

    @PutMapping("/users/{id}/quota")
    public ApiResponse<Void> updateQuota(@PathVariable String id, @Valid @RequestBody AdminRequests.UpdateQuotaRequest body) {
        int delta = body.delta() == null ? 0 : body.delta();
        if ("set".equals(body.mode())) {
            authService.setUserQuota(id, delta);
        } else {
            authService.updateUserQuota(id, delta, Boolean.TRUE.equals(body.resetUsedCount()));
        }
        return ApiResponse.ok();
    }

    @PutMapping("/users/{id}/status")
    public ApiResponse<Void> updateStatus(HttpServletRequest request, @PathVariable String id, @Valid @RequestBody AdminRequests.ToggleStatusRequest body) {
        if (Objects.equals(id, AuthContext.adminUserId(request))) {
            throw ApiException.forbidden("不能禁用自己的管理员账号");
        }
        authService.setUserStatus(id, body.status());
        return ApiResponse.ok();
    }

    @PutMapping("/users/{id}/unlimited")
    public ApiResponse<Void> unlimited(@PathVariable String id, @Valid @RequestBody AdminRequests.ToggleUnlimitedRequest body) {
        authService.setUserUnlimited(id, Boolean.TRUE.equals(body.unlimited()));
        return ApiResponse.ok();
    }

    @DeleteMapping("/users/{id}")
    public ApiResponse<Void> deleteUser(HttpServletRequest request, @PathVariable String id) {
        if (Objects.equals(id, AuthContext.adminUserId(request))) {
            throw ApiException.forbidden("不能删除自己的管理员账号");
        }
        authService.deleteUser(id);
        return ApiResponse.ok();
    }

    @DeleteMapping("/users")
    public ApiPayloads.Deleted deleteUsers(HttpServletRequest request, @Valid @RequestBody AdminRequests.IdsRequest body) {
        List<String> ids = body.ids();
        if (ids.contains(AuthContext.adminUserId(request))) {
            throw ApiException.forbidden("不能删除自己的管理员账号");
        }
        return new ApiPayloads.Deleted(authService.deleteUsers(ids));
    }

    @PostMapping("/codes")
    public ApiPayloads.Codes createCodes(@Valid @RequestBody AdminRequests.CreateCodesRequest body) {
        int count = body.count() == null ? 1 : body.count();
        java.util.ArrayList<com.tripcanvas.backend.dto.response.RedemptionCodeResponse> codes = new java.util.ArrayList<>();
        for (int i = 0; i < count; i++) {
            codes.add(authService.createRedemptionCode(body.quota() == null ? 0 : body.quota()));
        }
        return new ApiPayloads.Codes(codes);
    }

    @GetMapping("/codes")
    public ApiPayloads.Codes codes() {
        return new ApiPayloads.Codes(authService.listRedemptionCodes());
    }

    @DeleteMapping("/codes")
    public ApiPayloads.Deleted deleteCodes(@Valid @RequestBody AdminRequests.IdsRequest body) {
        return new ApiPayloads.Deleted(authService.deleteCodes(body.ids()));
    }

    @GetMapping("/config/endpoints")
    public ApiPayloads.EndpointPools endpoints() {
        return endpointPools();
    }

    @PutMapping("/config/endpoints")
    public ApiPayloads.EndpointPools updateEndpoints(@Valid @RequestBody AdminRequests.EndpointPoolsRequest body) {
        appConfigService.setEndpointPools(body);
        return endpointPools();
    }

    @GetMapping("/config/pricing")
    public AppConfigService.PricingConfig pricing() {
        return appConfigService.pricingConfig();
    }

    @PutMapping("/config/pricing")
    public AppConfigService.PricingConfig updatePricing(@Valid @RequestBody AdminRequests.PricingConfigRequest body) {
        return appConfigService.setPricingConfig(body);
    }

    @GetMapping("/announcement")
    public AnnouncementResponse announcement() {
        return announcementService.getAnnouncement();
    }

    @PutMapping("/announcement")
    public AnnouncementResponse updateAnnouncement(@Valid @RequestBody AnnouncementRequest body) {
        return announcementService.updateAnnouncement(body.content(), Boolean.TRUE.equals(body.enabled()));
    }

    @GetMapping("/analytics/summary")
    public ApiPayloads.AnalyticsSummary summary(@RequestParam(value = "range", required = false) String range) {
        AnalyticsService.AnalyticsRange r = analyticsService.parseRange(range, Instant.now());
        return new ApiPayloads.AnalyticsSummary(analyticsService.meta(r), analyticsService.summary(r));
    }

    @GetMapping("/analytics/trend")
    public ApiPayloads.AnalyticsTrend trend(@RequestParam(value = "range", required = false) String range) {
        AnalyticsService.AnalyticsRange r = analyticsService.parseRange(range, Instant.now());
        return new ApiPayloads.AnalyticsTrend(analyticsService.meta(r), analyticsService.trend(r));
    }

    @GetMapping("/analytics/endpoints")
    public ApiPayloads.AnalyticsRows<?> endpointBreakdown(@RequestParam(value = "range", required = false) String range) {
        AnalyticsService.AnalyticsRange r = analyticsService.parseRange(range, Instant.now());
        return new ApiPayloads.AnalyticsRows<>(analyticsService.meta(r), analyticsService.endpointBreakdown(r));
    }

    @GetMapping("/analytics/users")
    public ApiPayloads.AnalyticsRows<?> userBreakdown(@RequestParam(value = "range", required = false) String range) {
        AnalyticsService.AnalyticsRange r = analyticsService.parseRange(range, Instant.now());
        return new ApiPayloads.AnalyticsRows<>(analyticsService.meta(r), analyticsService.userBreakdown(r));
    }

    @GetMapping("/analytics/image-sizes")
    public ApiPayloads.AnalyticsRows<?> imageSizeBreakdown(@RequestParam(value = "range", required = false) String range) {
        AnalyticsService.AnalyticsRange r = analyticsService.parseRange(range, Instant.now());
        return new ApiPayloads.AnalyticsRows<>(analyticsService.meta(r), analyticsService.imageSizeBreakdown(r));
    }

    @GetMapping("/analytics/endpoint-sizes")
    public ApiPayloads.AnalyticsRows<?> endpointSizeBreakdown(@RequestParam(value = "range", required = false) String range) {
        AnalyticsService.AnalyticsRange r = analyticsService.parseRange(range, Instant.now());
        return new ApiPayloads.AnalyticsRows<>(analyticsService.meta(r), analyticsService.endpointSizeBreakdown(r));
    }

    @DeleteMapping("/analytics")
    public ApiPayloads.Deleted clearAnalytics() {
        return new ApiPayloads.Deleted(analyticsService.clear());
    }

    @PutMapping("/users/{id}/password")
    public ApiResponse<Void> resetPassword(@PathVariable String id, @Valid @RequestBody AdminRequests.ResetPasswordRequest body) {
        authService.adminResetPassword(id, body.password());
        return ApiResponse.ok();
    }

    @GetMapping("/invite-config")
    public ApiPayloads.InviteConfig inviteConfig() {
        return ApiPayloads.InviteConfig.from(appConfigService.inviteConfig());
    }

    @PutMapping("/invite-config")
    public ApiPayloads.InviteConfig updateInviteConfig(@Valid @RequestBody AdminRequests.InviteConfigRequest body) {
        AppConfigService.InviteConfig config = appConfigService.setInviteConfig(body);
        return ApiPayloads.InviteConfig.from(config);
    }

    @GetMapping("/email-config")
    public AppConfigService.EmailConfig emailConfig() {
        return appConfigService.emailConfig();
    }

    @PutMapping("/email-config")
    public AppConfigService.EmailConfig updateEmailConfig(@Valid @RequestBody AdminRequests.EmailConfigRequest body) {
        return appConfigService.setEmailConfig(body);
    }

    @GetMapping("/invites")
    public InvitesPayload invites() {
        return new InvitesPayload(authService.listInvites());
    }

    private ApiPayloads.EndpointPools endpointPools() {
        return new ApiPayloads.EndpointPools(
            appConfigService.endpointPool("auto"),
            appConfigService.endpointPool("1K"),
            appConfigService.endpointPool("2K"),
            appConfigService.endpointPool("4K")
        );
    }

    public record InvitesPayload(List<com.tripcanvas.backend.dto.response.InviteResponses.InviteRow> invites) {
    }
}
