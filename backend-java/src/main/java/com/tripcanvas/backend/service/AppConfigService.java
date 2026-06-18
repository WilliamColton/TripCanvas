package com.tripcanvas.backend.service;

import com.tripcanvas.backend.dto.request.AdminRequests;
import com.tripcanvas.backend.dto.response.ApiEndpointResponse;
import com.tripcanvas.backend.dto.response.AppConfigResponse;
import java.util.List;

public interface AppConfigService {
    AppConfigResponse publicConfig();

    String jwtSecret();

    String adminApikey();

    String model();

    String apiMode();

    int timeout();

    boolean codexCli();

    List<ApiEndpointResponse> endpointPool(String pool);

    void setEndpointPools(AdminRequests.EndpointPoolsRequest request);

    PricingConfig pricingConfig();

    PricingConfig setPricingConfig(AdminRequests.PricingConfigRequest request);

    InviteConfig inviteConfig();

    InviteConfig setInviteConfig(AdminRequests.InviteConfigRequest request);

    long salePriceForTier(String tier);

    record PricingConfig(
        List<ApiEndpointResponse> endpointsAuto,
        List<ApiEndpointResponse> endpoints1K,
        List<ApiEndpointResponse> endpoints2K,
        List<ApiEndpointResponse> endpoints4K,
        long salePriceX10000,
        String salePricingMode,
        long salePrice1KX10000,
        long salePrice2KX10000,
        long salePrice4KX10000,
        long moneyScale,
        boolean ok
    ) {
        public PricingConfig(
            List<ApiEndpointResponse> endpointsAuto,
            List<ApiEndpointResponse> endpoints1K,
            List<ApiEndpointResponse> endpoints2K,
            List<ApiEndpointResponse> endpoints4K,
            long salePriceX10000,
            String salePricingMode,
            long salePrice1KX10000,
            long salePrice2KX10000,
            long salePrice4KX10000,
            long moneyScale
        ) {
            this(
                endpointsAuto,
                endpoints1K,
                endpoints2K,
                endpoints4K,
                salePriceX10000,
                salePricingMode,
                salePrice1KX10000,
                salePrice2KX10000,
                salePrice4KX10000,
                moneyScale,
                true
            );
        }
    }

    record InviteConfig(int inviterReward, int inviteeReward, int defaultQuota, boolean inviteEnabled) {
    }
}
