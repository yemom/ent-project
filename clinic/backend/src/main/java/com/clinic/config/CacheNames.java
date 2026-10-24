package com.clinic.config;

public final class CacheNames {

    // `LAB_NOTIFICATIONS` and `LAB_NOTIFICATION_COUNTS` were removed with the
    // legacy lab-notification stack. Caching per user id is exactly what that
    // design invited, and it is now redundant: the unified `notifications` table is
    // owner-scoped on every read, so a cached page could never leak between users
    // and there is nothing left to cache per-user.
    public static final String LAB_ORDERS = "labOrders";
    public static final String LAB_RESULTS = "labResults";
    public static final String DOCTOR_AVAILABILITY = "doctorAvailability";

    private CacheNames() {
    }
}
