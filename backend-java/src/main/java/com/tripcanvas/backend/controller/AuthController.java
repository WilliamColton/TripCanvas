package com.tripcanvas.backend.controller;

import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.dto.request.AuthRequests;
import com.tripcanvas.backend.common.web.ApiResponse;
import com.tripcanvas.backend.dto.response.ApiPayloads;
import com.tripcanvas.backend.dto.response.AuthUserResponse;
import com.tripcanvas.backend.security.AuthContext;
import com.tripcanvas.backend.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/login")
    public ApiPayloads.AuthLogin login(@Valid @RequestBody AuthRequests.LoginCodeRequest request) {
        AuthService.AuthResult result = authService.loginWithCode(request.code());
        return new ApiPayloads.AuthLogin(result.token(), result.user(), result.needsMigration());
    }

    @PostMapping("/redeem")
    public RedeemPayload redeem(HttpServletRequest servletRequest, @Valid @RequestBody AuthRequests.RedeemRequest request) {
        String userId = AuthContext.requireUserId(servletRequest);
        authService.redeemForUser(userId, request.code());
        AuthUserResponse user = authService.findAuthUserById(userId, false);
        return new RedeemPayload(user.quota(), user.usedCount());
    }

    @GetMapping("/me")
    public ApiPayloads.User me(HttpServletRequest request) {
        return new ApiPayloads.User(authService.findAuthUserById(AuthContext.requireUserId(request), true));
    }

    @PostMapping("/login-password")
    public ApiPayloads.AuthLogin loginPassword(@Valid @RequestBody AuthRequests.LoginPasswordRequest request) {
        AuthService.AuthResult result = authService.loginWithPassword(request.username(), request.password());
        return new ApiPayloads.AuthLogin(result.token(), result.user(), result.needsMigration());
    }

    @PostMapping("/register")
    public RegisterPayload register(@Valid @RequestBody AuthRequests.RegisterRequest request) {
        authService.registerWithEmail(request.email(), request.username(), request.password(), request.inviteCode());
        return new RegisterPayload(true);
    }

    @PostMapping("/verify-email")
    public ApiPayloads.AuthLogin verifyEmail(@Valid @RequestBody AuthRequests.VerifyEmailRequest request) {
        AuthService.AuthResult result = authService.verifyEmail(request.email(), request.code());
        return new ApiPayloads.AuthLogin(result.token(), result.user(), result.needsMigration());
    }

    @PostMapping("/resend-verify-code")
    public ApiResponse<Void> resendVerifyCode(@Valid @RequestBody AuthRequests.ResendVerifyCodeRequest request) {
        authService.resendVerifyCode(request.email());
        return ApiResponse.ok();
    }

    @PostMapping("/migrate")
    public ApiPayloads.User migrate(HttpServletRequest servletRequest, @Valid @RequestBody AuthRequests.MigrateRequest request) {
        if (!java.util.Objects.equals(request.password(), request.confirmPassword())) {
            throw ApiException.badRequest("两次输入的密码不一致");
        }
        return new ApiPayloads.User(authService.migrateUser(AuthContext.requireUserId(servletRequest), request.username(), request.password()));
    }

    @PutMapping("/username")
    public ApiResponse<Void> changeUsername(HttpServletRequest servletRequest, @Valid @RequestBody AuthRequests.ChangeUsernameRequest request) {
        authService.changeUsername(AuthContext.requireUserId(servletRequest), request.username());
        return ApiResponse.ok();
    }

    @PostMapping("/change-password")
    public ApiResponse<Void> changePassword(HttpServletRequest servletRequest, @Valid @RequestBody AuthRequests.ChangePasswordRequest request) {
        if (!java.util.Objects.equals(request.newPassword(), request.confirmPassword())) {
            throw ApiException.badRequest("两次输入的密码不一致");
        }
        authService.changePassword(AuthContext.requireUserId(servletRequest), request.oldPassword(), request.newPassword());
        return ApiResponse.ok();
    }

    @PutMapping("/invite-code")
    public ApiResponse<Void> setInviteCode(HttpServletRequest servletRequest, @Valid @RequestBody AuthRequests.InviteCodeRequest request) {
        authService.setInviteCode(AuthContext.requireUserId(servletRequest), request.code());
        return ApiResponse.ok();
    }

    @GetMapping("/invite-code")
    public ApiPayloads.InviteCode getInviteCode(HttpServletRequest servletRequest) {
        AuthService.InviteCodeResult result = authService.getInviteCode(AuthContext.requireUserId(servletRequest));
        return new ApiPayloads.InviteCode(result.code(), result.setAt());
    }

    @GetMapping("/invited-users")
    public ApiPayloads.InvitedUsers invitedUsers(HttpServletRequest servletRequest) {
        return new ApiPayloads.InvitedUsers(authService.getInvitedUsers(AuthContext.requireUserId(servletRequest)));
    }

    public record RedeemPayload(boolean ok, int quota, int usedCount) {
        public RedeemPayload(int quota, int usedCount) {
            this(true, quota, usedCount);
        }
    }

    public record RegisterPayload(boolean pendingEmail) {
    }
}
