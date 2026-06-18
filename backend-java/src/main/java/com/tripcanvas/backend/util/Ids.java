package com.tripcanvas.backend.util;

import java.security.SecureRandom;

public final class Ids {
    private static final char[] CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private Ids() {
    }

    public static String generate() {
        char[] chars = new char[21];
        for (int i = 0; i < chars.length; i++) {
            chars[i] = CHARS[RANDOM.nextInt(CHARS.length)];
        }
        return new String(chars);
    }
}
