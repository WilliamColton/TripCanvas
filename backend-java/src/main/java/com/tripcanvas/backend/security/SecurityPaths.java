package com.tripcanvas.backend.security;

public final class SecurityPaths {
    public static final String ADMIN_PATTERN = "/api/admin/**";
    public static final String ADMIN_LOGIN = "/api/admin/login";
    public static final String[] PUBLIC_MATCHERS = {
        "/api/health",
        "/api/config/public",
        "/api/announcement",
        "/api/changelog",
        "/api/changelog/latest",
        "/api/template-preview-images/**",
        "/api/auth/login",
        "/api/auth/login-password",
        "/api/auth/register",
        "/api/auth/verify-email",
        "/api/auth/resend-verify-code",
        ADMIN_LOGIN
    };

    private SecurityPaths() {
    }

    public static boolean isAdminRequest(String path) {
        return isAdminPath(path) && !ADMIN_LOGIN.equals(path);
    }

    public static boolean isPublicRequest(String path) {
        if (path == null) {
            return false;
        }
        return "/api/health".equals(path)
            || "/api/config/public".equals(path)
            || "/api/announcement".equals(path)
            || "/api/changelog".equals(path)
            || "/api/changelog/latest".equals(path)
            || "/api/auth/login".equals(path)
            || "/api/auth/login-password".equals(path)
            || "/api/auth/register".equals(path)
            || "/api/auth/verify-email".equals(path)
            || "/api/auth/resend-verify-code".equals(path)
            || ADMIN_LOGIN.equals(path)
            || path.startsWith("/api/template-preview-images/");
    }

    private static boolean isAdminPath(String path) {
        return "/api/admin".equals(path) || path != null && path.startsWith("/api/admin/");
    }
}
