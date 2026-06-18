package com.tripcanvas.backend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.common.web.ApiResponse;
import com.tripcanvas.backend.dto.response.AuthUserResponse;
import com.tripcanvas.backend.service.AuthService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final AuthService authService;
    private final ObjectMapper objectMapper;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!path.startsWith("/api/") || HttpMethod.OPTIONS.matches(request.getMethod()) || SecurityPaths.isPublicRequest(path)) {
            filterChain.doFilter(request, response);
            return;
        }
        boolean adminRequired = SecurityPaths.isAdminRequest(path);
        String token = tokenFromRequest(request, !adminRequired);
        if (token == null || token.isBlank()) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            JwtService.JwtClaims claims = jwtService.verify(token);
            AuthUserResponse user = authService.findAuthUserById(claims.sub(), false);
            if (adminRequired && (!"admin".equals(claims.role()) || !"admin".equals(user.role()))) {
                writeError(response, HttpServletResponse.SC_FORBIDDEN, "无管理员权限");
                return;
            }

            bindRequestContext(request, user, adminRequired);
            bindSecurityContext(request, user);
            filterChain.doFilter(request, response);
        } catch (ApiException e) {
            writeError(response, e.getStatus().value(), e.getMessage());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private String tokenFromRequest(HttpServletRequest request, boolean allowQueryToken) {
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            return auth.substring("Bearer ".length());
        }
        return allowQueryToken ? request.getParameter("token") : null;
    }

    private void bindRequestContext(HttpServletRequest request, AuthUserResponse user, boolean adminRequired) {
        request.setAttribute(AuthContext.AUTH_USER, user);
        request.setAttribute(AuthContext.USER_ID, user.id());
        if (adminRequired) {
            request.setAttribute(AuthContext.ADMIN_USER_ID, user.id());
        }
    }

    private void bindSecurityContext(HttpServletRequest request, AuthUserResponse user) {
        String role = "admin".equals(user.role()) ? "ADMIN" : "USER";
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
            user,
            null,
            List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase(Locale.ROOT)))
        );
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private void writeError(HttpServletResponse response, int status, String message) throws IOException {
        if (response.isCommitted()) {
            return;
        }
        response.setStatus(status);
        response.setCharacterEncoding("UTF-8");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), ApiResponse.error(message));
    }
}
