package com.clinic.service.impl;

import com.clinic.dto.request.ForgotPasswordRequest;
import com.clinic.dto.request.ResetPasswordRequest;
import com.clinic.dto.response.ForgotPasswordResponse;
import com.clinic.entity.AuditAction;
import com.clinic.entity.PasswordResetToken;
import com.clinic.entity.User;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ServiceUnavailableException;
import com.clinic.mail.EmailMessage;
import com.clinic.mail.EmailSender;
import com.clinic.repository.PasswordResetTokenRepository;
import com.clinic.repository.UserRepository;
import com.clinic.service.AuditLogService;
import com.clinic.service.AuthService;
import com.clinic.service.PasswordResetService;
import com.clinic.validation.PasswordPolicy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

/**
 * Password reset over a single-use, expiring, hashed token.
 *
 * <p>See {@link PasswordResetService} for the policy this implements. The
 * comments below concentrate on the two things that are easy to get subtly wrong
 * here: enumeration resistance, and not leaving a usable secret lying around.
 */
@Service
@Slf4j
public class PasswordResetServiceImpl implements PasswordResetService {

    /**
     * Bytes of {@link SecureRandom} output in the emailed token. 32 bytes is 256
     * bits, which is not a guessable quantity regardless of rate limiting.
     */
    private static final int TOKEN_BYTES = 32;

    /**
     * A real hash cost, applied on the "no such account" path too.
     *
     * <p>Without it, a request for a registered address costs a database lookup
     * plus an SMTP round trip while an unregistered one returns immediately. That
     * difference is far above measurement noise and is a perfectly good account
     * oracle — so the cheap path is padded to match.
     */
    private static final String TIMING_EQUALISER = "not-a-real-password-but-costs-the-same-to-hash";

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final EmailSender emailSender;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;
    private final AuditLogService auditLogService;
    private final SecureRandom secureRandom = new SecureRandom();

    private final Duration tokenTtl;
    private final Duration issuanceWindow;
    private final int maxIssuancesPerWindow;
    private final String frontendResetUrl;
    private final String clinicName;

    public PasswordResetServiceImpl(
            UserRepository userRepository,
            PasswordResetTokenRepository tokenRepository,
            EmailSender emailSender,
            PasswordEncoder passwordEncoder,
            AuthService authService,
            AuditLogService auditLogService,
            @Value("${app.password-reset.token-ttl-minutes:30}") long tokenTtlMinutes,
            @Value("${app.password-reset.max-issuances-per-window:3}") int maxIssuancesPerWindow,
            @Value("${app.password-reset.issuance-window-minutes:60}") long issuanceWindowMinutes,
            @Value("${app.password-reset.frontend-reset-url:http://localhost:3001/reset-password}") String frontendResetUrl,
            @Value("${app.clinic-name:Clinic Care}") String clinicName
    ) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.emailSender = emailSender;
        this.passwordEncoder = passwordEncoder;
        this.authService = authService;
        this.auditLogService = auditLogService;
        this.tokenTtl = Duration.ofMinutes(tokenTtlMinutes);
        this.issuanceWindow = Duration.ofMinutes(issuanceWindowMinutes);
        this.maxIssuancesPerWindow = maxIssuancesPerWindow;
        this.frontendResetUrl = frontendResetUrl;
        this.clinicName = clinicName;
    }

    @Override
    @Transactional
    public ForgotPasswordResponse requestReset(ForgotPasswordRequest request, String clientIp) {
        // Checked first, before any token exists. Issuing one we cannot deliver
        // would leave a live credential nobody holds, and would tell the user to
        // watch an inbox that will stay empty.
        if (!emailSender.isConfigured()) {
            log.warn("Password reset requested but no mail transport is configured (MAIL_HOST is unset); clientIp={}", clientIp);
            throw new ServiceUnavailableException(ForgotPasswordResponse.TRANSPORT_UNAVAILABLE_MESSAGE);
        }

        String email = normalise(request.email());
        Optional<User> maybeUser = userRepository.findByEmailIgnoreCase(email);

        if (maybeUser.isEmpty() || !maybeUser.get().getActive()) {
            // Same work, same response, same log shape. The caller learns nothing.
            passwordEncoder.encode(TIMING_EQUALISER);
            auditLogService.recordAnonymous(email, AuditAction.USER_PASSWORD_RESET, "USER", null,
                    "Password reset requested for an address with no active account", clientIp);
            return ForgotPasswordResponse.accepted();
        }

        User user = maybeUser.get();

        Instant since = Instant.now().minus(issuanceWindow);
        if (tokenRepository.countIssuedSince(user.getId(), since) >= maxIssuancesPerWindow) {
            // Refusing loudly here is safe: the caller already proved they can
            // mint tokens for this account, so nothing new is disclosed.
            log.warn("Password reset issuance cap reached for userId={}", user.getId());
            throw new BadRequestException(
                    "Too many password reset requests for this account. Please wait before trying again, "
                            + "or contact the clinic.");
        }

        // One live token per account: a new request silently retires the previous
        // one, so an attacker who intercepted an older mail cannot use it later.
        Instant now = Instant.now();
        tokenRepository.findByUserIdAndUsedAtIsNull(user.getId()).forEach(existing -> {
            existing.setUsedAt(now);
            tokenRepository.save(existing);
        });

        String token = generateToken();
        tokenRepository.save(PasswordResetToken.builder()
                .id(UUID.randomUUID().toString())
                .userId(user.getId())
                .tokenHash(sha256Hex(token))
                .expiresAt(now.plus(tokenTtl))
                .createdAt(now)
                .build());

        try {
            emailSender.send(new EmailMessage(
                    user.getEmail(),
                    "Reset your " + clinicName + " password",
                    buildEmailBody(user.getFullName(), token, tokenTtl)));
        } catch (RuntimeException ex) {
            // The token must not survive a failed send: an undelivered link is a
            // live credential sitting in a table for nobody.
            tokenRepository.deleteAll(tokenRepository.findByUserIdAndUsedAtIsNull(user.getId()));
            auditLogService.record(AuditAction.USER_PASSWORD_RESET, "USER", user.getId(),
                    "Password reset email could not be delivered (clientIp=" + clientIp + ")");
            log.warn("Password reset email delivery failed for userId={}: {}", user.getId(), ex.getMessage());
            throw new ServiceUnavailableException(
                    "We could not send the reset email. Please try again shortly or contact the clinic.");
        }

        // The audit entry records that a reset was requested, never the token and
        // never the link. `userId` is the resource identifier a reviewer needs.
        auditLogService.record(AuditAction.USER_PASSWORD_RESET, "USER", user.getId(),
                "Password reset requested (clientIp=" + clientIp + ")");
        log.info("Password reset token issued for userId={}, expiresAt={}", user.getId(), now.plus(tokenTtl));

        return ForgotPasswordResponse.accepted();
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        if (!PasswordPolicy.isValid(request.newPassword())) {
            throw new BadRequestException(PasswordPolicy.MESSAGE);
        }

        PasswordResetToken stored = tokenRepository.findByTokenHash(sha256Hex(request.token()))
                // Unknown, expired and reused tokens are indistinguishable on the
                // way out. Distinguishing them tells an attacker which half-life
                // they are up against and whether a guess was on the right track.
                .orElseThrow(() -> new BadRequestException("This password reset link is invalid or has expired."));

        Instant now = Instant.now();
        if (!stored.isUsable(now)) {
            auditLogService.recordAnonymous(null, AuditAction.USER_PASSWORD_RESET, "USER", stored.getUserId(),
                    "Rejected a password reset with an expired or already-used token", null);
            throw new BadRequestException("This password reset link is invalid or has expired.");
        }

        User user = userRepository.findById(stored.getUserId())
                .filter(User::getActive)
                .orElseThrow(() -> new BadRequestException("This password reset link is invalid or has expired."));

        user.setPassword(passwordEncoder.encode(request.newPassword()));
        // A self-service reset clears the forced-change flag set for a handed-out
        // initial password; the user has now chosen their own.
        user.setMustChangePassword(false);
        userRepository.save(user);

        // Spend the token before anything that could throw, so a failure later in
        // the request cannot leave it redeemable a second time.
        stored.setUsedAt(now);
        tokenRepository.save(stored);

        // End every existing session. A password reset is how a user recovers from
        // a compromise, so leaving the old sessions alive would defeat the point.
        authService.revokeAllRefreshTokens(user.getId());

        auditLogService.record(AuditAction.USER_PASSWORD_RESET, "USER", user.getId(),
                "Password changed via emailed reset token; all refresh tokens revoked");
        log.info("Password reset completed for userId={}", user.getId());
    }

    /**
     * 256 bits from {@link SecureRandom}, URL-safe and unpadded so it survives a
     * query string without escaping.
     */
    private String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            // SHA-256 is required of every JRE; failing here means a broken runtime.
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    /** Local part case is technically significant; the domain part is not. */
    private String normalise(String email) {
        String trimmed = email == null ? "" : email.trim();
        int at = trimmed.lastIndexOf('@');
        if (at < 0) {
            return trimmed;
        }
        return trimmed.substring(0, at).toLowerCase(java.util.Locale.ROOT) + trimmed.substring(at);
    }

    private String buildEmailBody(String fullName, String token, Duration ttl) {
        long minutes = ttl.toMinutes();
        return """
                Hello %s,

                A password reset was requested for your %s account.

                Use this link to choose a new password:

                %s?token=%s

                The link expires in %d minutes and can be used once. If you did not
                request this, no action is needed — your password has not changed.

                If the link does not work, contact the clinic and a staff member will
                help you in person.

                --
                This is an automated message. Please do not reply to it.
                """.formatted(
                fullName == null || fullName.isBlank() ? "there" : fullName,
                clinicName,
                frontendResetUrl,
                token,
                minutes);
    }
}