package com.tripcanvas.backend.security;

import com.tripcanvas.backend.dto.response.AuthUserResponse;
import jakarta.servlet.http.HttpServletRequest;

public final class AuthContext {
    public static final String AUTH_USER = "authUser";
    public static final String USER_ID = "userID";
    public static final String ADMIN_USER_ID = "adminUserID";

    private AuthContext() {
    }

    public static AuthUserResponse requireUser(HttpServletRequest request) {
        Object value = request.getAttribute(AUTH_USER);
        if (value instanceof AuthUserResponse user) {
            return user;
        }
        throw new IllegalStateException("auth user missing");
    }

    public static String requireUserId(HttpServletRequest request) {
        Object value = request.getAttribute(USER_ID);
        if (value instanceof String id) {
            return id;
        }
        throw new IllegalStateException("user id missing");
    }

    public static String adminUserId(HttpServletRequest request) {
        Object value = request.getAttribute(ADMIN_USER_ID);
        return value instanceof String id ? id : "";
    }
}
