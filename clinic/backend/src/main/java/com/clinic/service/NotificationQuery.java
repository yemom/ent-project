package com.clinic.service;

import com.clinic.entity.NotificationType;

/**
 * Optional narrowing applied to the caller's own notification list.
 *
 * <p>Every field is nullable and a {@code null} means "do not filter on this", so
 * the unfiltered list and a filtered one travel the same code path. That matters
 * because the filter is combined with the recipient scope rather than replacing
 * it: a patient narrowing by type still cannot see anything that was not theirs.
 *
 * <p>There is deliberately no priority field. {@code Notification} has no priority
 * column, so filtering by one would mean inventing a value the database does not
 * hold. Type and read state are the two dimensions the schema can answer honestly.
 *
 * @param type only notifications of this category, or {@code null} for all
 * @param read {@code true} for read only, {@code false} for unread only,
 *             {@code null} for both
 */
public record NotificationQuery(NotificationType type, Boolean read) {

    public static final NotificationQuery ALL = new NotificationQuery(null, null);

    public static NotificationQuery ofType(NotificationType type) {
        return new NotificationQuery(type, null);
    }

    /** The single unread filter the notification screen offers. */
    public static NotificationQuery unread() {
        return new NotificationQuery(null, Boolean.FALSE);
    }

    public boolean isUnfiltered() {
        return type == null && read == null;
    }
}
