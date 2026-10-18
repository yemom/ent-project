package com.clinic.service;

import com.clinic.dto.request.ForgotPasswordRequest;
import com.clinic.dto.request.ResetPasswordRequest;
import com.clinic.dto.response.ForgotPasswordResponse;

/**
 * Self-service password reset.
 *
 * <p>The security properties this service exists to provide, in one place:
 *
 * <ul>
 *   <li><b>No enumeration.</b> {@link #requestReset} returns the same body for an
 *       unknown address, a deactivated account, and a real one, and does roughly
 *       the same amount of work in each case so the timing does not leak either.</li>
 *   <li><b>Hash at rest.</b> Only a SHA-256 digest is persisted, so a database leak
 *       is not a set of usable reset links.</li>
 *   <li><b>Single use, short-lived.</b> A redeemed token is marked spent; a new
 *       request invalidates any earlier outstanding token for that account.</li>
 *   <li><b>Abuse-bounded.</b> Per-IP limiting is the existing
 *       {@code RateLimitingFilter}; this adds a persisted per-account cap so
 *       rotating source addresses does not help.</li>
 *   <li><b>Honest about configuration.</b> With no mail transport the request is
 *       refused before a token is generated, so no user is told to check an inbox
 *       that will stay empty.</li>
 *   <li><b>Session-invalidating.</b> A successful reset revokes every refresh
 *       token for the account, so a stolen session cannot outlive the password.</li>
 * </ul>
 */
public interface PasswordResetService {

    /**
     * Starts a reset. Never reveals whether the address is registered.
     *
     * @param request  the address to send to
     * @param clientIp caller's address, recorded for abuse investigation only
     * @throws ServiceUnavailableException if no mail transport is configured
     */
    ForgotPasswordResponse requestReset(ForgotPasswordRequest request, String clientIp);

    /**
     * Redeems a token and sets a new password.
     *
     * @throws BadRequestException if the token is unknown, expired, already used,
     *                             or the new password fails the policy
     */
    void resetPassword(ResetPasswordRequest request);
}