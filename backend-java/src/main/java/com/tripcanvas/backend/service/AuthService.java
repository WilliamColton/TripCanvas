package com.tripcanvas.backend.service;

import com.tripcanvas.backend.dto.response.AdminUserResponse;
import com.tripcanvas.backend.dto.response.AuthUserResponse;
import com.tripcanvas.backend.dto.response.InviteResponses;
import com.tripcanvas.backend.dto.response.RedemptionCodeResponse;
import java.util.List;

public interface AuthService {
    AuthResult loginWithCode(String code);

    AuthResult loginWithPassword(String username, String password);

    AuthResult register(String username, String password, String inviteCode);

    AuthUserResponse migrateUser(String userId, String username, String password);

    void redeemForUser(String userId, String code);

    AuthUserResponse findAuthUserById(String id, boolean withImageCount);

    void changeUsername(String userId, String username);

    void changePassword(String userId, String oldPassword, String newPassword);

    void setInviteCode(String userId, String code);

    InviteCodeResult getInviteCode(String userId);

    List<InviteResponses.InvitedUserRow> getInvitedUsers(String userId);

    List<AdminUserResponse> listAllUsers();

    void updateUserQuota(String userId, int delta, boolean resetUsedCount);

    void setUserQuota(String userId, int quota);

    void setUserStatus(String userId, String status);

    void setUserUnlimited(String userId, boolean unlimited);

    void deleteUser(String userId);

    long deleteUsers(List<String> ids);

    RedemptionCodeResponse createRedemptionCode(int quota);

    List<RedemptionCodeResponse> listRedemptionCodes();

    long deleteCodes(List<String> ids);

    void incrementUsedCount(String userId, int count);

    void adminResetPassword(String userId, String password);

    List<InviteResponses.InviteRow> listInvites();

    String findActiveAdminUserId();

    record AuthResult(String token, AuthUserResponse user, boolean needsMigration) {
    }

    record InviteCodeResult(String code, Long setAt) {
    }
}
