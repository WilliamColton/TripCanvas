package com.tripcanvas.backend.util;

import java.time.Instant;

public final class Times {
    private Times() {
    }

    public static long nowMillis() {
        return Instant.now().toEpochMilli();
    }
}
