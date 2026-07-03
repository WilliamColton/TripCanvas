package com.tripcanvas.backend.service;

import com.tripcanvas.backend.common.exception.ApiException;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * 邮箱验证码流程的限流与失败计数（纵深防御）。
 *
 * <p>覆盖两类风险：
 * <ul>
 *   <li>验证码爆破：连续失败 {@link #MAX_VERIFY_ATTEMPTS} 次后锁定该邮箱 {@link #LOCKOUT_MS}。</li>
 *   <li>邮件轰炸：同一邮箱两次发送至少间隔 {@link #RESEND_INTERVAL_MS}，且一小时内最多 {@link #MAX_RESEND_PER_HOUR} 次。</li>
 * </ul>
 *
 * <p>状态保存在内存（单实例足够）；多实例部署需替换为 Redis 等共享存储。
 */
@Component
public class VerificationRateLimiter {
    private static final long RESEND_INTERVAL_MS = 60_000L;
    private static final int MAX_RESEND_PER_HOUR = 5;
    private static final int MAX_VERIFY_ATTEMPTS = 5;
    private static final long LOCKOUT_MS = 15 * 60_000L;
    private static final long HOUR_MS = 60 * 60_000L;

    private final Map<String, State> states = new ConcurrentHashMap<>();

    private static final class State {
        long lastSentAt;
        long windowStart;
        int resendCountInWindow;
        int failedAttempts;
        long lockedUntil;
    }

    /** 注册/重发发送前调用：通过则记录本次发送，否则抛 429。 */
    public void assertAndRecordResend(String email) {
        State st = stateFor(email);
        synchronized (st) {
            long now = System.currentTimeMillis();
            if (st.lockedUntil > now) {
                throw ApiException.tooManyRequests("验证失败次数过多，请稍后再试");
            }
            if (st.lastSentAt != 0 && now - st.lastSentAt < RESEND_INTERVAL_MS) {
                throw ApiException.tooManyRequests("验证码发送过于频繁，请稍后再试");
            }
            if (st.windowStart == 0 || now - st.windowStart > HOUR_MS) {
                st.windowStart = now;
                st.resendCountInWindow = 0;
            }
            if (st.resendCountInWindow >= MAX_RESEND_PER_HOUR) {
                throw ApiException.tooManyRequests("验证码发送次数过多，请稍后再试");
            }
            st.resendCountInWindow++;
            st.lastSentAt = now;
        }
    }

    /** 验证前调用：若该邮箱处于锁定期则抛 429。 */
    public void assertCanVerify(String email) {
        State st = stateFor(email);
        synchronized (st) {
            long now = System.currentTimeMillis();
            if (st.lockedUntil > now) {
                long minutes = Math.max(1, (st.lockedUntil - now + 59_999) / 60_000);
                throw ApiException.tooManyRequests("验证失败次数过多，请 " + minutes + " 分钟后再试或重新发送验证码");
            }
        }
    }

    /** 验证失败时调用：累加失败次数，达到阈值则锁定。 */
    public void recordVerifyFailure(String email) {
        State st = stateFor(email);
        synchronized (st) {
            st.failedAttempts++;
            if (st.failedAttempts >= MAX_VERIFY_ATTEMPTS) {
                st.lockedUntil = System.currentTimeMillis() + LOCKOUT_MS;
            }
        }
    }

    /** 验证成功后清除该邮箱的所有计数。 */
    public void clear(String email) {
        states.remove(normalize(email));
    }

    private State stateFor(String email) {
        return states.computeIfAbsent(normalize(email), k -> new State());
    }

    private static String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}
