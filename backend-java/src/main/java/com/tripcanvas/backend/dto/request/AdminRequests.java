package com.tripcanvas.backend.dto.request;

import com.tripcanvas.backend.dto.response.ApiEndpointResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public final class AdminRequests {
    private AdminRequests() {
    }

    public record AdminLoginRequest(@NotBlank(message = "请输入管理员密钥") @Size(max = 256, message = "管理员密钥过长") String apikey) {
    }

    public record UpdateQuotaRequest(
        @Pattern(regexp = "delta|set", message = "配额模式无效") String mode,
        Integer delta,
        Boolean resetUsedCount
    ) {
    }

    public record ToggleStatusRequest(@NotBlank(message = "状态不能为空") @Pattern(regexp = "active|disabled", message = "状态值无效") String status) {
    }

    public record ToggleUnlimitedRequest(Boolean unlimited) {
    }

    public record CreateCodesRequest(
        @Min(value = 1, message = "配额必须大于 0") Integer quota,
        @Min(value = 1, message = "单次至少创建 1 个兑换码")
        @Max(value = 100, message = "单次最多创建 100 个兑换码") Integer count
    ) {
    }

    public record IdsRequest(
        @NotEmpty(message = "请选择要操作的数据")
        @Size(max = 200, message = "单次最多操作 200 条数据")
        List<@NotBlank(message = "ID 不能为空") @Size(max = 64, message = "ID 无效") String> ids
    ) {
    }

    public record EndpointPoolsRequest(
        List<@Valid ApiEndpointResponse> endpointsAuto,
        List<@Valid ApiEndpointResponse> endpoints1K,
        List<@Valid ApiEndpointResponse> endpoints2K,
        List<@Valid ApiEndpointResponse> endpoints4K
    ) {
    }

    public record PricingConfigRequest(
        List<@Valid ApiEndpointResponse> endpointsAuto,
        List<@Valid ApiEndpointResponse> endpoints1K,
        List<@Valid ApiEndpointResponse> endpoints2K,
        List<@Valid ApiEndpointResponse> endpoints4K,
        @Min(value = 0, message = "售价不能小于 0") Long salePriceX10000,
        @Pattern(regexp = "unified|per_resolution", message = "售价模式无效，只能为 unified 或 per_resolution") String salePricingMode,
        @Min(value = 0, message = "1K 售价不能小于 0") Long salePrice1KX10000,
        @Min(value = 0, message = "2K 售价不能小于 0") Long salePrice2KX10000,
        @Min(value = 0, message = "4K 售价不能小于 0") Long salePrice4KX10000
    ) {
    }

    public record ResetPasswordRequest(@NotBlank(message = "请输入密码") @Size(min = 8, max = 200, message = "密码长度不正确") String password) {
    }

    public record InviteConfigRequest(
        @Min(value = 0, message = "邀请人奖励不能为负数") Integer inviterReward,
        @Min(value = 0, message = "被邀请人奖励不能为负数") Integer inviteeReward,
        @Min(value = 0, message = "默认配额不能为负数") Integer defaultQuota,
        Boolean inviteEnabled
    ) {
    }

    public record EmailConfigRequest(
        List<@Size(max = 64, message = "单个后缀过长") String> allowedSuffixes
    ) {
    }
}
