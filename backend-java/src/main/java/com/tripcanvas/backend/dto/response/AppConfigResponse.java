package com.tripcanvas.backend.dto.response;

public record AppConfigResponse(
    boolean codexCli,
    String apiMode,
    String model,
    int timeout,
    boolean inviteEnabled
) {
}
