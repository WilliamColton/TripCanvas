package com.tripcanvas.backend.dto.response;

import java.util.List;

public record AppConfigResponse(
    boolean codexCli,
    String apiMode,
    String model,
    int timeout,
    boolean inviteEnabled,
    List<String> allowedEmailSuffixes
) {
    public AppConfigResponse(boolean codexCli, String apiMode, String model, int timeout, boolean inviteEnabled) {
        this(codexCli, apiMode, model, timeout, inviteEnabled, List.of());
    }
}
