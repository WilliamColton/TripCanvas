package com.tripcanvas.backend.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthRequests {
    private AuthRequests() {
    }

    public record LoginCodeRequest(@NotBlank(message = "请输入兑换码") @Size(max = 64, message = "兑换码最多 64 个字符") String code) {
    }

    public record RedeemRequest(@NotBlank(message = "请输入兑换码") @Size(max = 64, message = "兑换码最多 64 个字符") String code) {
    }

    public record LoginPasswordRequest(
        @NotBlank(message = "请输入用户名") @Size(min = 3, max = 20, message = "用户名须为 3-20 个字符") String username,
        @NotBlank(message = "请输入密码") @Size(min = 8, max = 200, message = "密码长度不正确") String password
    ) {
    }

    public record RegisterRequest(
        @Size(max = 64, message = "邀请码最多 64 个字符") String inviteCode,
        @NotBlank(message = "请输入用户名") @Size(min = 3, max = 20, message = "用户名须为 3-20 个字符") String username,
        @NotBlank(message = "请输入密码") @Size(min = 8, max = 200, message = "密码长度不正确") String password
    ) {
    }

    public record MigrateRequest(
        @NotBlank(message = "请输入用户名") @Size(min = 3, max = 20, message = "用户名须为 3-20 个字符") String username,
        @NotBlank(message = "请输入密码") @Size(min = 8, max = 200, message = "密码长度不正确") String password,
        @NotBlank(message = "请确认密码") @Size(min = 8, max = 200, message = "密码长度不正确") String confirmPassword
    ) {
    }

    public record ChangeUsernameRequest(@NotBlank(message = "请输入用户名") @Size(min = 3, max = 20, message = "用户名须为 3-20 个字符") String username) {
    }

    public record ChangePasswordRequest(
        @NotBlank(message = "请输入旧密码") @Size(max = 200, message = "密码长度不正确") String oldPassword,
        @NotBlank(message = "请输入新密码") @Size(min = 8, max = 200, message = "密码长度不正确") String newPassword,
        @NotBlank(message = "请确认新密码") @Size(min = 8, max = 200, message = "密码长度不正确") String confirmPassword
    ) {
    }

    public record InviteCodeRequest(@NotBlank(message = "邀请码不能为空") @Size(max = 64, message = "邀请码最多 64 个字符") String code) {
    }
}
