package com.tripcanvas.backend.util;

import com.tripcanvas.backend.dto.response.TaskParamsResponse;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;

public final class ImageSizeUtils {
    public static final String POOL_AUTO = "auto";
    public static final String TIER_1K = "1K";
    public static final String TIER_2K = "2K";
    public static final String TIER_4K = "4K";

    private static final int SIZE_MULTIPLE = 16;
    private static final int MAX_EDGE = 3840;
    private static final double MAX_ASPECT_RATIO = 3.0;
    private static final int MIN_PIXELS = 655360;
    private static final int MAX_PIXELS = 8294400;
    private static final Pattern SIZE_PATTERN = Pattern.compile("^\\s*(\\d+)\\s*[xX×]\\s*(\\d+)\\s*$");

    private ImageSizeUtils() {
    }

    public static TaskParamsResponse normalizeTaskParams(TaskParamsResponse params) {
        TaskParamsResponse source = params == null
            ? new TaskParamsResponse(POOL_AUTO, null, "auto", "png", null, "auto", 1)
            : params;
        String normalizedSize = normalizeImageSize(source.size());
        return new TaskParamsResponse(
            normalizedSize,
            null,
            blankToDefault(source.quality(), "auto"),
            blankToDefault(source.outputFormat(), "png"),
            source.outputCompression(),
            blankToDefault(source.moderation(), "auto"),
            normalizeTaskN(source.n())
        );
    }

    public static RouteResult routePoolForTaskParams(TaskParamsResponse params) {
        TaskParamsResponse normalized = normalizeTaskParams(params);
        if (POOL_AUTO.equals(normalized.size())) {
            return new RouteResult(POOL_AUTO, "", normalized);
        }
        String tier = tierForSize(normalized.size());
        if (tier == null) {
            throw new IllegalArgumentException("尺寸参数无效");
        }
        return new RouteResult(tier, tier, normalized);
    }

    public static int normalizeTaskN(Integer n) {
        return com.tripcanvas.backend.service.TaskService.normalizeTaskN(n);
    }

    public static String normalizeImageSize(String size) {
        String trimmed = size == null ? "" : size.trim();
        if (trimmed.isEmpty() || POOL_AUTO.equalsIgnoreCase(trimmed)) {
            return POOL_AUTO;
        }
        Dimensions dimensions = parseImageSize(trimmed);
        if (dimensions == null) {
            throw new IllegalArgumentException("尺寸参数无效");
        }
        Dimensions normalized = normalizeDimensions(dimensions.width(), dimensions.height());
        return normalized.width() + "x" + normalized.height();
    }

    public static String tierForSize(String size) {
        String normalized;
        try {
            normalized = normalizeImageSize(size);
        } catch (IllegalArgumentException e) {
            return null;
        }
        if (POOL_AUTO.equals(normalized)) {
            return null;
        }
        Dimensions dimensions = parseImageSize(normalized);
        return dimensions == null ? null : tierForDimensions(dimensions.width(), dimensions.height());
    }

    public static String tierForDimensions(int width, int height) {
        int longest = Math.max(width, height);
        if (longest <= 1024) {
            return TIER_1K;
        }
        if (longest <= 2048) {
            return TIER_2K;
        }
        return TIER_4K;
    }

    public static String tierFromActualParams(TaskParamsResponse actualParams) {
        if (actualParams == null || actualParams.size() == null) {
            return null;
        }
        return tierForSize(actualParams.size());
    }

    public static String tierFromDataUrl(String dataUrl) {
        try {
            DataUrlUtils.ParsedDataUrl parsed = DataUrlUtils.parse(dataUrl);
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(parsed.bytes()));
            if (image == null || image.getWidth() <= 0 || image.getHeight() <= 0) {
                return null;
            }
            return tierForDimensions(image.getWidth(), image.getHeight());
        } catch (Exception e) {
            return null;
        }
    }

    private static Dimensions parseImageSize(String size) {
        Matcher matcher = SIZE_PATTERN.matcher(size);
        if (!matcher.matches()) {
            return null;
        }
        try {
            int width = Integer.parseInt(matcher.group(1));
            int height = Integer.parseInt(matcher.group(2));
            return width > 0 && height > 0 ? new Dimensions(width, height) : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Dimensions normalizeDimensions(int width, int height) {
        int normalizedWidth = roundToMultiple(width, SIZE_MULTIPLE);
        int normalizedHeight = roundToMultiple(height, SIZE_MULTIPLE);

        for (int i = 0; i < 4; i++) {
            int longest = Math.max(normalizedWidth, normalizedHeight);
            if (longest > MAX_EDGE) {
                double scale = (double) MAX_EDGE / longest;
                normalizedWidth = floorToMultiple(normalizedWidth * scale, SIZE_MULTIPLE);
                normalizedHeight = floorToMultiple(normalizedHeight * scale, SIZE_MULTIPLE);
            }

            if ((double) normalizedWidth / normalizedHeight > MAX_ASPECT_RATIO) {
                normalizedWidth = floorToMultiple(normalizedHeight * MAX_ASPECT_RATIO, SIZE_MULTIPLE);
            } else if ((double) normalizedHeight / normalizedWidth > MAX_ASPECT_RATIO) {
                normalizedHeight = floorToMultiple(normalizedWidth * MAX_ASPECT_RATIO, SIZE_MULTIPLE);
            }

            int pixels = normalizedWidth * normalizedHeight;
            if (pixels > MAX_PIXELS) {
                double scale = Math.sqrt((double) MAX_PIXELS / pixels);
                normalizedWidth = floorToMultiple(normalizedWidth * scale, SIZE_MULTIPLE);
                normalizedHeight = floorToMultiple(normalizedHeight * scale, SIZE_MULTIPLE);
            } else if (pixels < MIN_PIXELS) {
                double scale = Math.sqrt((double) MIN_PIXELS / pixels);
                normalizedWidth = ceilToMultiple(normalizedWidth * scale, SIZE_MULTIPLE);
                normalizedHeight = ceilToMultiple(normalizedHeight * scale, SIZE_MULTIPLE);
            }
        }
        return new Dimensions(normalizedWidth, normalizedHeight);
    }

    private static int roundToMultiple(double value, int multiple) {
        return Math.max(multiple, (int) Math.round(value / multiple) * multiple);
    }

    private static int floorToMultiple(double value, int multiple) {
        return Math.max(multiple, (int) Math.floor(value / multiple) * multiple);
    }

    private static int ceilToMultiple(double value, int multiple) {
        return Math.max(multiple, (int) Math.ceil(value / multiple) * multiple);
    }

    private static String blankToDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim().toLowerCase(Locale.ROOT);
    }

    private record Dimensions(int width, int height) {
    }

    public record RouteResult(String pool, String requestTier, TaskParamsResponse params) {
    }
}
