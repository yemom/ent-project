package com.clinic.ai;

/**
 * The provider could not produce an answer.
 *
 * <p>Carries a coarse {@link Reason} instead of a raw message so that anything
 * logged or returned to a caller stays free of provider internals, hostnames and
 * key fragments.
 */
public class AiProviderException extends RuntimeException {

    public enum Reason {
        /** The request exceeded the configured timeout. */
        TIMEOUT,
        /** The provider answered with a non-success status. */
        PROVIDER_ERROR,
        /** The provider answered with something this adapter cannot parse. */
        INVALID_RESPONSE,
        /** The outbound request could not be constructed. */
        INVALID_REQUEST,
        /** The transport failed below HTTP. */
        TRANSPORT_ERROR,
        /** The provider applied its own rate limit. */
        RATE_LIMITED,
        /** This deployment has no usable provider configured. */
        NOT_CONFIGURED
    }

    private final Reason reason;

    public AiProviderException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public AiProviderException(Reason reason, String message, Throwable cause) {
        super(message, cause);
        this.reason = reason;
    }

    public Reason getReason() {
        return reason;
    }
}