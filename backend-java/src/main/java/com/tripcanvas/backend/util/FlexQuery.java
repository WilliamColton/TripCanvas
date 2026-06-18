package com.tripcanvas.backend.util;

import com.mybatisflex.core.query.QueryWrapper;
import java.util.Collection;

public final class FlexQuery {
    private FlexQuery() {
    }

    public static QueryWrapper where(String condition, Object... args) {
        return QueryWrapper.create().where(condition, args);
    }

    public static QueryWrapper id(String id) {
        return where("id = ?", id);
    }

    public static QueryWrapper eq(String column, Object value) {
        return where(column + " = ?", value);
    }

    public static QueryWrapper and(QueryWrapper query, String condition, Object... args) {
        return query.and(condition, args);
    }

    public static QueryWrapper orderBy(QueryWrapper query, String orderBy) {
        return query.orderBy(orderBy);
    }

    public static QueryWrapper in(QueryWrapper query, String column, Collection<?> values) {
        return query.in(column, values);
    }
}
