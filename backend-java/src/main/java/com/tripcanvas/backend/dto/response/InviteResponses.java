package com.tripcanvas.backend.dto.response;

public final class InviteResponses {
    private InviteResponses() {
    }

    public record InviteRow(String username, String inviteCode, int usageCount) {
    }

    public record InvitedUserRow(String username, String label, long createdAt) {
    }
}
