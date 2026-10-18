package com.clinic.dto.response;

/**
 * The answer to a forgot-password request.
 *
 * <p>The {@code message} is identical whether or not the address belongs to an
 * account. That is the whole point: the response body must not be an account
 * oracle. The {@code emailSent} flag exists only to carry the deployment's own
 * health — "no mail transport configured" — which is the same for every caller and
 * reveals nothing about any particular address.
 *
 * @param message   a fixed, non-committal confirmation
 * @param emailSent {@code false} when no mail transport is configured; the caller
 *                  is told to contact the clinic rather than left waiting
 */
public record ForgotPasswordResponse(String message, boolean emailSent) {

    /**
     * The single response used for every outcome, including "no such account".
     *
     * <p>Kept as a constant so the strings cannot drift apart between code paths.
     */
    public static final String GENERIC_MESSAGE =
            "If an account exists for that address, a password reset link has been sent.";

    public static final String TRANSPORT_UNAVAILABLE_MESSAGE =
            "Password reset by email is not available on this system. Please contact the clinic to have your password reset.";

    public static ForgotPasswordResponse accepted() {
        return new ForgotPasswordResponse(GENERIC_MESSAGE, true);
    }

    public static ForgotPasswordResponse transportUnavailable() {
        return new ForgotPasswordResponse(TRANSPORT_UNAVAILABLE_MESSAGE, false);
    }
}