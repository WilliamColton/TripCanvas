package com.tripcanvas.backend.service.impl;

import com.mybatisflex.core.query.QueryWrapper;
import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.dto.response.AdminUserResponse;
import com.tripcanvas.backend.dto.response.AuthUserResponse;
import com.tripcanvas.backend.dto.response.InviteResponses;
import com.tripcanvas.backend.dto.response.RedemptionCodeResponse;
import com.tripcanvas.backend.entity.RedemptionCodeEntity;
import com.tripcanvas.backend.entity.UserEntity;
import com.tripcanvas.backend.mapper.ImageMapper;
import com.tripcanvas.backend.mapper.RedemptionCodeMapper;
import com.tripcanvas.backend.mapper.UserMapper;
import com.tripcanvas.backend.security.JwtService;
import com.tripcanvas.backend.service.AppConfigService;
import com.tripcanvas.backend.service.AuthService;
import com.tripcanvas.backend.structmapper.AuthDtoMapper;
import com.tripcanvas.backend.util.FlexQuery;
import com.tripcanvas.backend.util.Ids;
import com.tripcanvas.backend.util.Times;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {
    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserMapper userMapper;
    private final RedemptionCodeMapper codeMapper;
    private final ImageMapper imageMapper;
    private final JwtService jwtService;
    private final AppConfigService appConfigService;
    private final AuthDtoMapper authDtoMapper;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Override
    @Transactional
    public AuthResult loginWithCode(String code) {
        String normalized = normalizeCode(code);
        RedemptionCodeEntity rc = selectCode(normalized);
        UserEntity loginUser;
        long now = Times.nowMillis();
        if (rc.getUsedBy() != null) {
            loginUser = selectUserById(rc.getUsedBy());
            if ("disabled".equals(loginUser.getStatus())) {
                throw ApiException.unauthorized("账号已被禁用");
            }
            loginUser.setLastLoginAt(now);
            userMapper.update(loginUser);
        } else {
            loginUser = new UserEntity()
                .setId(Ids.generate())
                .setLabel(normalized)
                .setRole("user")
                .setStatus("active")
                .setQuota(rc.getQuota())
                .setUnlimitedQuota(0)
                .setUsedCount(0)
                .setCreatedAt(now)
                .setLastLoginAt(now);
            userMapper.insert(loginUser);
            rc.setUsedBy(loginUser.getId()).setUsedAt(now);
            codeMapper.update(rc);
        }
        String token = jwtService.signToken(loginUser.getId(), loginUser.getRole());
        AuthUserResponse user = toAuthUser(loginUser, false);
        return new AuthResult(token, user, Boolean.TRUE.equals(user.needsMigration()));
    }

    @Override
    public AuthResult loginWithPassword(String username, String password) {
        UserEntity user = userMapper.selectOneByQuery(FlexQuery.eq("username", username));
        if (user == null || user.getPasswordHash() == null || !passwordEncoder.matches(nullToEmpty(password), user.getPasswordHash())) {
            throw ApiException.unauthorized("用户名或密码错误");
        }
        if ("disabled".equals(user.getStatus())) {
            throw ApiException.unauthorized("账号已被禁用");
        }
        user.setLastLoginAt(Times.nowMillis());
        userMapper.update(user);
        return new AuthResult(jwtService.signToken(user.getId(), user.getRole()), toAuthUser(user, false), false);
    }

    @Override
    @Transactional
    public AuthResult register(String username, String password, String inviteCode) {
        validateUsername(username);
        validatePassword(password);
        if (userMapper.selectOneByQuery(FlexQuery.eq("username", username)) != null) {
            throw ApiException.badRequest("用户名已被使用");
        }
        String normalizedInviteCode = inviteCode == null ? "" : inviteCode.trim();
        if (!appConfigService.inviteConfig().inviteEnabled() && !normalizedInviteCode.isEmpty()) {
            throw ApiException.badRequest("邀请功能已关闭");
        }
        UserEntity inviter = null;
        if (!normalizedInviteCode.isEmpty()) {
            inviter = userMapper.selectOneByQuery(FlexQuery.eq("invite_code", normalizedInviteCode));
            if (inviter == null) {
                throw ApiException.badRequest("邀请码无效");
            }
        }

        int quota = appConfigService.inviteConfig().defaultQuota();
        if (inviter != null) {
            quota += appConfigService.inviteConfig().inviteeReward();
        }
        long now = Times.nowMillis();
        String userId = Ids.generate();
        UserEntity user = new UserEntity()
            .setId(userId)
            .setLabel(userId.substring(0, Math.min(8, userId.length())))
            .setUsername(username)
            .setPasswordHash(passwordEncoder.encode(password))
            .setRole("user")
            .setStatus("active")
            .setQuota(quota)
            .setUnlimitedQuota(0)
            .setUsedCount(0)
            .setCreatedAt(now)
            .setLastLoginAt(now)
            .setInvitedBy(normalizedInviteCode.isEmpty() ? null : normalizedInviteCode);
        userMapper.insert(user);

        if (inviter != null && appConfigService.inviteConfig().inviterReward() > 0) {
            inviter.setQuota(nullToZero(inviter.getQuota()) + appConfigService.inviteConfig().inviterReward());
            userMapper.update(inviter);
        }
        return new AuthResult(jwtService.signToken(userId, "user"), toAuthUser(user, false), false);
    }

    @Override
    public AuthUserResponse migrateUser(String userId, String username, String password) {
        validateUsername(username);
        validatePassword(password);
        UserEntity existing = userMapper.selectOneByQuery(FlexQuery.and(FlexQuery.eq("username", username), "id != ?", userId));
        if (existing != null) {
            throw ApiException.badRequest("用户名已被使用");
        }
        UserEntity user = selectUserById(userId);
        user.setUsername(username).setPasswordHash(passwordEncoder.encode(password));
        userMapper.update(user);
        return toAuthUser(user, false);
    }

    @Override
    @Transactional
    public void redeemForUser(String userId, String code) {
        RedemptionCodeEntity rc = selectCode(normalizeCode(code));
        if (rc.getUsedBy() != null) {
            throw ApiException.badRequest("该兑换码已被使用");
        }
        UserEntity user = selectUserById(userId);
        rc.setUsedBy(userId).setUsedAt(Times.nowMillis());
        codeMapper.update(rc);
        user.setQuota(nullToZero(user.getQuota()) + nullToZero(rc.getQuota()));
        userMapper.update(user);
    }

    @Override
    public AuthUserResponse findAuthUserById(String id, boolean withImageCount) {
        UserEntity user = selectUserById(id);
        if ("disabled".equals(user.getStatus())) {
            throw ApiException.unauthorized("登录状态无效");
        }
        return toAuthUser(user, withImageCount);
    }

    @Override
    public void changeUsername(String userId, String username) {
        validateUsername(username);
        UserEntity existing = userMapper.selectOneByQuery(FlexQuery.and(FlexQuery.eq("username", username), "id != ?", userId));
        if (existing != null) {
            throw ApiException.badRequest("用户名已被使用");
        }
        UserEntity user = selectUserById(userId);
        user.setUsername(username);
        userMapper.update(user);
    }

    @Override
    public void changePassword(String userId, String oldPassword, String newPassword) {
        validatePassword(newPassword);
        UserEntity user = selectUserById(userId);
        if (user.getPasswordHash() == null) {
            throw ApiException.badRequest("该账号尚未设置密码");
        }
        if (!passwordEncoder.matches(nullToEmpty(oldPassword), user.getPasswordHash())) {
            throw ApiException.badRequest("旧密码不正确");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userMapper.update(user);
    }

    @Override
    public void setInviteCode(String userId, String code) {
        String trimmed = code == null ? "" : code.trim();
        if (trimmed.isEmpty()) {
            throw ApiException.badRequest("邀请码不能为空");
        }
        UserEntity user = selectUserById(userId);
        UserEntity existing = userMapper.selectOneByQuery(FlexQuery.and(FlexQuery.eq("invite_code", trimmed), "id != ?", userId));
        if (existing != null) {
            throw ApiException.badRequest("该邀请码已被使用");
        }
        user.setInviteCode(trimmed).setInviteCodeSetAt(Times.nowMillis());
        userMapper.update(user);
    }

    @Override
    public InviteCodeResult getInviteCode(String userId) {
        UserEntity user = selectUserById(userId);
        return new InviteCodeResult(user.getInviteCode(), user.getInviteCodeSetAt());
    }

    @Override
    public List<InviteResponses.InvitedUserRow> getInvitedUsers(String userId) {
        UserEntity user = selectUserById(userId);
        if (user.getInviteCode() == null || user.getInviteCode().isBlank()) {
            return List.of();
        }
        QueryWrapper query = FlexQuery.orderBy(FlexQuery.eq("invited_by", user.getInviteCode()), "created_at DESC");
        return userMapper.selectListByQuery(query).stream()
            .map(u -> new InviteResponses.InvitedUserRow(nullToEmpty(u.getUsername()), u.getLabel(), nullToZeroLong(u.getCreatedAt())))
            .toList();
    }

    @Override
    public List<AdminUserResponse> listAllUsers() {
        QueryWrapper query = FlexQuery.orderBy(QueryWrapper.create(), "created_at DESC");
        return userMapper.selectListByQuery(query).stream().map(this::toAdminUser).toList();
    }

    @Override
    public void updateUserQuota(String userId, int delta, boolean resetUsedCount) {
        UserEntity user = selectUserById(userId);
        user.setQuota(Math.max(0, nullToZero(user.getQuota()) + delta));
        if (resetUsedCount) {
            user.setUsedCount(0);
        }
        userMapper.update(user);
    }

    @Override
    public void setUserQuota(String userId, int quota) {
        if (quota < 0) {
            throw ApiException.badRequest("配额不能小于 0");
        }
        UserEntity user = selectUserById(userId);
        user.setQuota(quota);
        userMapper.update(user);
    }

    @Override
    public void setUserStatus(String userId, String status) {
        if (!"active".equals(status) && !"disabled".equals(status)) {
            throw ApiException.badRequest("状态值无效");
        }
        UserEntity user = selectUserById(userId);
        user.setStatus(status);
        userMapper.update(user);
    }

    @Override
    public void setUserUnlimited(String userId, boolean unlimited) {
        UserEntity user = selectUserById(userId);
        user.setUnlimitedQuota(unlimited ? 1 : 0);
        userMapper.update(user);
    }

    @Override
    public void deleteUser(String userId) {
        int affected = userMapper.deleteById(userId);
        if (affected == 0) {
            throw ApiException.notFound("用户不存在");
        }
    }

    @Override
    public long deleteUsers(List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        return userMapper.deleteByQuery(FlexQuery.in(QueryWrapper.create(), "id", ids));
    }

    @Override
    public RedemptionCodeResponse createRedemptionCode(int quota) {
        if (quota <= 0) {
            throw ApiException.badRequest("配额必须大于 0");
        }
        RedemptionCodeEntity rc = new RedemptionCodeEntity()
            .setId(Ids.generate())
            .setCode(generateCode(20))
            .setQuota(quota)
            .setCreatedAt(Times.nowMillis());
        codeMapper.insert(rc);
        return toCode(rc);
    }

    @Override
    public List<RedemptionCodeResponse> listRedemptionCodes() {
        return codeMapper.selectListByQuery(FlexQuery.orderBy(QueryWrapper.create(), "created_at DESC")).stream().map(this::toCode).toList();
    }

    @Override
    public long deleteCodes(List<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        return codeMapper.deleteByQuery(FlexQuery.in(QueryWrapper.create(), "id", ids));
    }

    @Override
    public void incrementUsedCount(String userId, int count) {
        UserEntity user = selectUserById(userId);
        user.setUsedCount(nullToZero(user.getUsedCount()) + count);
        userMapper.update(user);
    }

    @Override
    public void adminResetPassword(String userId, String password) {
        validatePassword(password);
        UserEntity user = selectUserById(userId);
        user.setPasswordHash(passwordEncoder.encode(password));
        userMapper.update(user);
    }

    @Override
    public List<InviteResponses.InviteRow> listInvites() {
        List<UserEntity> owners = userMapper.selectListByQuery(FlexQuery.where("invite_code IS NOT NULL"));
        List<InviteResponses.InviteRow> rows = new ArrayList<>();
        for (UserEntity owner : owners) {
            long count = userMapper.selectCountByQuery(FlexQuery.eq("invited_by", owner.getInviteCode()));
            rows.add(new InviteResponses.InviteRow(nullToEmpty(owner.getUsername()), owner.getInviteCode(), (int) count));
        }
        return rows;
    }

    @Override
    public String findActiveAdminUserId() {
        UserEntity admin = userMapper.selectOneByQuery(FlexQuery.and(FlexQuery.eq("role", "admin"), "status = ?", "active"));
        if (admin == null) {
            throw ApiException.internal("管理员账号不存在");
        }
        return admin.getId();
    }

    private RedemptionCodeEntity selectCode(String code) {
        RedemptionCodeEntity rc = codeMapper.selectOneByQuery(FlexQuery.eq("code", code));
        if (rc == null) {
            throw ApiException.unauthorized("兑换码无效");
        }
        return rc;
    }

    private UserEntity selectUserById(String id) {
        UserEntity user = userMapper.selectOneById(id);
        if (user == null) {
            throw ApiException.unauthorized("登录状态无效");
        }
        return user;
    }

    private AuthUserResponse toAuthUser(UserEntity user, boolean withImageCount) {
        int imageCount = 0;
        if (withImageCount) {
            imageCount = (int) imageMapper.selectCountByQuery(FlexQuery.and(FlexQuery.eq("user_id", user.getId()), "source = ?", "generated"));
        }
        return authDtoMapper.toAuthUser(user, imageCount);
    }

    private AdminUserResponse toAdminUser(UserEntity user) {
        return authDtoMapper.toAdminUser(user);
    }

    private RedemptionCodeResponse toCode(RedemptionCodeEntity rc) {
        return authDtoMapper.toCode(rc);
    }

    private void validateUsername(String username) {
        int len = username == null ? 0 : username.codePointCount(0, username.length());
        if (len < 3 || len > 20) {
            throw ApiException.badRequest("用户名须为 3-20 个字符");
        }
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < 8) {
            throw ApiException.badRequest("密码至少需要 8 个字符");
        }
    }

    private String normalizeCode(String code) {
        String normalized = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            throw ApiException.badRequest("请输入兑换码");
        }
        return normalized;
    }

    private String generateCode(int length) {
        StringBuilder builder = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            builder.append(CODE_CHARS.charAt(RANDOM.nextInt(CODE_CHARS.length())));
        }
        return builder.toString();
    }

    private int nullToZero(Integer value) {
        return value == null ? 0 : value;
    }

    private long nullToZeroLong(Long value) {
        return value == null ? 0L : value;
    }

    private String nullToEmpty(String value) {
        return Objects.toString(value, "");
    }
}
