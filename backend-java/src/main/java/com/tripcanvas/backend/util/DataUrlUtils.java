package com.tripcanvas.backend.util;

import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class DataUrlUtils {
    private static final Pattern DATA_URL = Pattern.compile("^data:([^;]+);base64,(.+)$", Pattern.DOTALL);

    private DataUrlUtils() {
    }

    public static ParsedDataUrl parse(String dataUrl) {
        if (dataUrl == null || dataUrl.isBlank()) {
            throw new IllegalArgumentException("无效的 data URL");
        }
        Matcher matcher = DATA_URL.matcher(dataUrl);
        if (!matcher.matches()) {
            throw new IllegalArgumentException("无效的 data URL");
        }
        try {
            return new ParsedDataUrl(Base64.getDecoder().decode(matcher.group(2)), matcher.group(1));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("base64 解码失败", e);
        }
    }

    public static String toDataUrl(byte[] bytes, String mime) {
        String contentType = mime == null || mime.isBlank() ? "image/png" : mime;
        return "data:" + contentType + ";base64," + Base64.getEncoder().encodeToString(bytes);
    }

    public record ParsedDataUrl(byte[] bytes, String mime) {
    }
}
