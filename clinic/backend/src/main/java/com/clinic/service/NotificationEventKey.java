package com.clinic.service;

/**
 * Builds the deterministic identity of a business event.
 *
 * <p>Notifications used to be written unconditionally, so a retried request or a
 * double-clicked button produced a second identical row for the same recipient. The
 * bell filled with duplicates and stopped being read, which is worse than sending
 * nothing.
 *
 * <p>A key answers one question: "have I already told this person about this exact
 * change?". It is built only from things that are true of the event itself —
 *
 * <ul>
 *   <li>the event type, so a booking and its cancellation are distinct;</li>
 *   <li>the resource id, so two appointments do not collide;</li>
 *   <li>a discriminator for the transition, so a status change to
 *       {@code CONFIRMED} and one to {@code NO_SHOW} are distinct;</li>
 *   <li>the recipient, so a fan-out to a doctor, a patient and reception each get
 *       their own row;</li>
 *   <li>an optional scope discriminator, for a resource that legitimately produces
 *       several distinct notifications — one per lab result, say.</li>
 * </ul>
 *
 * <p>What must <em>not</em> appear is anything that varies between two attempts at
 * the same event: no timestamp, no request id, no attempt counter. Including any of
 * those would make every attempt look new and defeat the point.
 */
public final class NotificationEventKey {

    /** Keeps a long compound key inside the column width. */
    private static final int MAX_LENGTH = 300;

    private NotificationEventKey() {
    }

    /**
     * @param eventType    stable name of the event, e.g. {@code APPOINTMENT_CREATED}
     * @param resourceId   the record the event concerns
     * @param discriminator what distinguishes two events of the same type on the
     *                      same resource, e.g. the new status. May be {@code null}.
     * @param recipientId  the user the notification is for
     * @param scope        an optional further discriminator, e.g. a result id. May be
     *                     {@code null}.
     */
    public static String of(String eventType,
                            String resourceId,
                            String discriminator,
                            String recipientId,
                            String scope) {
        String key = String.join("|",
                safe(eventType),
                safe(resourceId),
                safe(discriminator),
                safe(recipientId),
                safe(scope));
        return key.length() <= MAX_LENGTH ? key : key.substring(0, MAX_LENGTH);
    }

    /** Convenience for events with no transition discriminator. */
    public static String of(String eventType, String resourceId, String recipientId) {
        return of(eventType, resourceId, null, recipientId, null);
    }

    /**
     * Hashes an arbitrary value into a bounded, collision-resistant fragment.
     *
     * <p>Used when a component is long or free-text — a prescription reference, a
     * batch number — and the column width has to be respected. SHA-256 truncated to
     * 16 hex characters is 64 bits, which is ample for a uniqueness constraint
     * whose population is one hospital's event volume.
     */
    public static String digest(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        try {
            byte[] hash = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash).substring(0, 16);
        } catch (java.security.NoSuchAlgorithmException ex) {
            // SHA-256 is required of every JRE; a missing one is a broken runtime.
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private static String safe(String value) {
        if (value == null) {
            return "";
        }
        // The pipe is the field separator; a value containing one could otherwise
        // be arranged to impersonate a different key.
        return value.replace("|", "/");
    }
}