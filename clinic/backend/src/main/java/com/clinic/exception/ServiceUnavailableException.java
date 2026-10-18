package com.clinic.exception;

/**
 * The feature exists and the caller is allowed to use it, but a dependency it
 * needs is not configured.
 *
 * <p>Used where returning success would be a lie — password reset with no mail
 * transport, for instance. The message is written to be actionable for a hospital
 * administrator and free of any internal detail, because it reaches an
 * unauthenticated caller.
 */
public class ServiceUnavailableException extends RuntimeException {

    public ServiceUnavailableException(String message) {
        super(message);
    }
}