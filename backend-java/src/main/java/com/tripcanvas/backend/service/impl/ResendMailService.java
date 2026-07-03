package com.tripcanvas.backend.service.impl;

import com.tripcanvas.backend.common.exception.ApiException;
import com.tripcanvas.backend.service.AppConfigService;
import com.tripcanvas.backend.service.AppConfigService.MailConfig;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Service
@Slf4j
public class ResendMailService {
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(10);
    private static final String BASE_URL = "https://api.resend.com";

    private final AppConfigService appConfigService;
    private final RestClient restClient;

    public ResendMailService(AppConfigService appConfigService, RestClient.Builder restClientBuilder) {
        this.appConfigService = appConfigService;
        this.restClient = restClientBuilder
            .requestFactory(requestFactory())
            .baseUrl(BASE_URL)
            .build();
    }

    private static ClientHttpRequestFactory requestFactory() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) CONNECT_TIMEOUT.toMillis());
        factory.setReadTimeout((int) READ_TIMEOUT.toMillis());
        return factory;
    }

    public void sendVerificationCode(String email, String code) {
        MailConfig mail = appConfigService.mailConfig();
        if (mail.apiKey() == null || mail.apiKey().isBlank() || "change-me-resend".equals(mail.apiKey())) {
            log.warn("Resend API key 未配置，跳过发送验证邮件 to={}", email);
            throw ApiException.internal("邮件服务未配置，请联系管理员");
        }
        int ttlMinutes = Math.max(1, mail.verificationTtlSeconds() / 60);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("from", mail.from());
        body.put("to", List.of(email));
        body.put("subject", "精品旅图 邮箱验证码");
        body.put("html", "<p>您的精品旅图验证码是 <b>" + code + "</b>，"
            + ttlMinutes + " 分钟内有效。如非本人操作请忽略本邮件。</p>");
        try {
            restClient.post()
                .uri("/emails")
                .header("Authorization", "Bearer " + mail.apiKey())
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();
        } catch (RestClientResponseException e) {
            log.error("Resend 发送验证邮件失败 to={} status={} body={}", email, e.getStatusCode().value(), e.getResponseBodyAsString());
            throw ApiException.internal("邮件发送失败，请稍后重试");
        } catch (Exception e) {
            log.error("Resend 发送验证邮件异常 to={}", email, e);
            throw ApiException.internal("邮件发送失败，请稍后重试");
        }
    }
}
