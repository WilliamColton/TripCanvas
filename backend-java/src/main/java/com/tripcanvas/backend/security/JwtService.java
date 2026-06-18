package com.tripcanvas.backend.security;

import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.service.AppConfigService;
import com.tripcanvas.backend.util.CryptoUtils;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import javax.crypto.SecretKey;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class JwtService {
    private final AppConfigService appConfigService;

    public String signToken(String userId, String role) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(userId)
            .claim("role", role)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plus(30, ChronoUnit.DAYS)))
            .signWith(secretKey())
            .compact();
    }

    public JwtClaims verify(String token) {
        try {
            Claims claims = Jwts.parser()
                .verifyWith(secretKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
            String sub = claims.getSubject();
            String role = claims.get("role", String.class);
            if (sub == null || sub.isBlank()) {
                throw ApiException.unauthorized("登录状态无效");
            }
            if (!"admin".equals(role)) {
                role = "user";
            }
            return new JwtClaims(sub, role);
        } catch (Exception e) {
            throw ApiException.unauthorized("登录状态无效");
        }
    }

    private SecretKey secretKey() {
        byte[] key = CryptoUtils.sha256Hex(appConfigService.jwtSecret().getBytes(StandardCharsets.UTF_8)).getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(key);
    }

    public record JwtClaims(String sub, String role) {
    }
}
