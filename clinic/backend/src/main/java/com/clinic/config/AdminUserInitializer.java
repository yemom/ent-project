package com.clinic.config;

import com.clinic.entity.AdminUser;
import com.clinic.entity.AuditAction;
import com.clinic.entity.User;
import com.clinic.entity.UserRole;
import com.clinic.repository.UserRepository;
import com.clinic.service.AuditLogService;
import com.clinic.validation.PasswordPolicy;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Secure bootstrap of the permanent Super Admin account.
 *
 * <p>
 * Design rules, all of them load-bearing:
 * <ul>
 * <li><b>No credential is ever hardcoded.</b> The password comes from
 * {@code SUPER_ADMIN_PASSWORD}. If that variable is absent, a
 * cryptographically random password is generated once and printed to the
 * deployment log as a single WARN line. It is never written to source,
 * never logged again on a later boot, and never included in an API
 * response.</li>
 * <li><b>Idempotent.</b> Every boot looks for the account and only ever
 * <em>promotes</em> it. An account that is already SUPER_ADMIN keeps its
 * existing password and profile, so restarting a deployment never rotates a
 * working credential.</li>
 * <li><b>Match by email, then by name.</b> This repairs the historical case
 * where the founder exists under {@code ADMIN} or as a Patient row but
 * needs the SUPER_ADMIN role.</li>
 * <li><b>Self-healing roles.</b> If the founder row is a Patient (the shape
 * older versions of this initializer created), it is converted to a
 * proper {@link AdminUser} so {@code user_type} is correct.</li>
 * <li><b>Legacy names still work.</b> {@code SUPER_ADMIN_NAME}/{@code SUPER_ADMIN_EMAIL}/
 * {@code SUPER_ADMIN_PASSWORD} are honoured as fallbacks so an existing Render
 * configuration does not lock the operator out on the next deploy.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AdminUserInitializer implements ApplicationRunner {

    private static final SecureRandom RANDOM = new SecureRandom();

    /**
     * Owner of the deployment. Matched case-insensitively as a fallback.
     *
     * <p>
     * {@code SUPER_ADMIN_*} is the canonical name; the {@code ADMIN_*} variants
     * are read as defaults so a deployment configured with the older names keeps
     * working after this rename.
     */
    @Value("${SUPER_ADMIN_NAME:${ADMIN_NAME:Esrom Basazinaw}}")
    private String superAdminName;

    @Value("${SUPER_ADMIN_EMAIL:${ADMIN_EMAIL:}}")
    private String superAdminEmail;

    @Value("${SUPER_ADMIN_PASSWORD:${ADMIN_PASSWORD:}}")
    private String superAdminPassword;

    /**
     * Recovery switch: re-apply {@link #superAdminPassword} to the founder account
     * even when it is already a Super Admin.
     *
     * <p>Off by default, deliberately. If the password were synced on every boot,
     * anyone able to change an environment variable could silently take over the
     * Super Admin account — the exact vulnerability this class exists to prevent.
     * Setting it to {@code true} is an explicit one-off operator action for when the
     * configured password and the stored one have drifted (a forgotten password, a
     * rotated secret, an account promoted by hand). Leave it unset afterwards: it
     * does nothing on a healthy deployment.
     */
    @Value("${SUPER_ADMIN_FORCE_PASSWORD:false}")
    private boolean forceSuperAdminPassword;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    private final EntityManager entityManager;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Optional<User> existing = findExistingAccount();
        if (existing.isPresent()) {
            promote(existing.get());
            return;
        }
        create();
    }

    // ------------------------------------------------------------------
    // Lookup
    // ------------------------------------------------------------------

    /**
     * Finds the founder by email when configured, otherwise by name.
     * Both lookups are exact/case-insensitive — never a fuzzy match, so an
     * unrelated account can never be promoted by accident.
     */
    private Optional<User> findExistingAccount() {
        if (hasText(superAdminEmail)) {
            Optional<User> byEmail = userRepository.findByEmailIgnoreCase(superAdminEmail.trim());
            if (byEmail.isPresent()) {
                log.info("Super Admin bootstrap: found account by email={}", superAdminEmail.trim());
                return byEmail;
            }
            log.info("Super Admin bootstrap: no account for email={}", superAdminEmail.trim());
        }

        if (hasText(superAdminName)) {
            Optional<User> byName = findByFullName(superAdminName.trim());
            if (byName.isPresent()) {
                log.info("Super Admin bootstrap: found account by name=\"{}\"", superAdminName.trim());
                return byName;
            }
        }

        return Optional.empty();
    }

    private Optional<User> findByFullName(String fullName) {
        String needle = fullName.toLowerCase(Locale.ROOT);
        List<User> matches = userRepository.findAll().stream()
                .filter(user -> user.getFullName() != null
                        && user.getFullName().toLowerCase(Locale.ROOT).equals(needle))
                .toList();
        if (matches.isEmpty()) {
            return Optional.empty();
        }
        if (matches.size() > 1) {
            // Ambiguous: refuse rather than pick one and grant it super-admin rights.
            log.warn("Super Admin bootstrap: {} accounts named \"{}\"; refusing to promote any of them. "
                    + "Set SUPER_ADMIN_EMAIL to disambiguate.",
                    matches.size(), fullName);
            return Optional.empty();
        }
        return Optional.of(matches.get(0));
    }

    // ------------------------------------------------------------------
    // Promotion
    // ------------------------------------------------------------------

    /**
     * Promotes an existing account to SUPER_ADMIN.
     *
     * <p>When the stored row has a different {@code user_type} discriminator (e.g. the
     * founder row was created as a {@code PATIENT} by an older version of this class),
     * Hibernate cannot re-type it through the JPA object model — {@code merge()} on a
     * new {@link AdminUser} with the same PK throws {@code NonUniqueObjectException}
     * (session already tracks it) or a duplicate-PK INSERT (if we detach first, Hibernate
     * treats the new entity as transient and tries to INSERT it).
     *
     * <p>The only reliable fix is a <em>native SQL UPDATE</em> that directly sets
     * {@code user_type = 'ADMIN'}, {@code role = 'SUPER_ADMIN'}, and optionally
     * {@code password = ?} in one statement — entirely bypassing Hibernate's object
     * identity. We then evict the old entry from the 1st-level cache and reload the
     * now-correctly-typed row.
     */
    private void promote(User user) {
        if (user.getRole() == UserRole.SUPER_ADMIN && !forceSuperAdminPassword) {
            log.info("Super Admin bootstrap: \"{}\" already holds SUPER_ADMIN; nothing to do.",
                    user.getFullName());
            return;
        }

        UserRole previous = user.getRole();

        // Determine the new password hash (may be unchanged).
        String newPasswordHash = user.getPassword();
        boolean passwordApplied = false;
        if (hasText(superAdminPassword)) {
            if (!PasswordPolicy.isValid(superAdminPassword)) {
                log.error("Super Admin bootstrap: SUPER_ADMIN_PASSWORD does not meet the password policy "
                        + "({}). Keeping the existing password for \"{}\".",
                        PasswordPolicy.MESSAGE, user.getFullName());
            } else {
                newPasswordHash = passwordEncoder.encode(superAdminPassword);
                passwordApplied = true;
            }
        }

        // Use a native UPDATE so Hibernate never tries to INSERT or merge a
        // type-mismatched entity.  This is the only safe way to change the
        // single-table-inheritance discriminator on a live row.
        entityManager.createNativeQuery(
                "UPDATE users SET user_type = 'ADMIN', role = 'SUPER_ADMIN', "
                + "password = :pw, updated_at = now() WHERE id = :id")
                .setParameter("pw", newPasswordHash)
                .setParameter("id", user.getId())
                .executeUpdate();

        // Evict the stale entity from the 1st-level cache so the next findById
        // returns the correctly-typed AdminUser.
        entityManager.detach(user);
        entityManager.flush();

        if (previous == UserRole.SUPER_ADMIN) {
            log.info("Super Admin bootstrap: \"{}\" already held SUPER_ADMIN; {}",
                    user.getFullName(),
                    passwordApplied
                            ? "password re-applied because SUPER_ADMIN_FORCE_PASSWORD is set"
                            : "password left unchanged");
        } else {
            log.info("Super Admin bootstrap: promoted \"{}\" from {} to SUPER_ADMIN ({}).",
                    user.getFullName(), previous,
                    passwordApplied ? "bootstrap password applied" : "existing password kept");
        }

        auditLogService.record(AuditAction.ROLE_CHANGED, "USER", user.getId(),
                passwordApplied && previous == UserRole.SUPER_ADMIN
                        ? "Super Admin password reset by the bootstrap initializer"
                        : "Promoted to SUPER_ADMIN by the bootstrap initializer (was " + previous + ")");
    }

    /**
     * Sets the configured password on a promoted account, if one is configured and
     * it satisfies the password policy.
     *
     * @return whether the password was changed
     */
    private boolean applyBootstrapPasswordIfConfigured(User user) {
        if (!hasText(superAdminPassword)) {
            return false;
        }
        if (!PasswordPolicy.isValid(superAdminPassword)) {
            log.error("Super Admin bootstrap: SUPER_ADMIN_PASSWORD does not meet the password policy "
                    + "({}). Keeping the existing password for \"{}\".",
                    PasswordPolicy.MESSAGE, user.getFullName());
            return false;
        }
        user.setPassword(passwordEncoder.encode(superAdminPassword));
        return true;
    }

    // ------------------------------------------------------------------
    // Creation
    // ------------------------------------------------------------------

    private void create() {
        String email = resolveEmail();
        String name = resolveName();

        // A generated password is shown exactly once, in this boot's log.
        boolean generated = !hasText(superAdminPassword);
        String password = generated ? generatePassword() : superAdminPassword;

        if (!PasswordPolicy.isValid(password)) {
            // Never silently substitute a known password — that would reintroduce
            // the exact vulnerability this class exists to remove.
            log.error("Super Admin bootstrap: SUPER_ADMIN_PASSWORD does not meet the password policy "
                    + "({}). Refusing to create the account with a non-compliant password.",
                    PasswordPolicy.MESSAGE);
            return;
        }

        AdminUser superAdmin = AdminUser.builder()
                .fullName(name)
                .email(email)
                .password(passwordEncoder.encode(password))
                .role(UserRole.SUPER_ADMIN)
                .active(true)
                .build();

        userRepository.saveAndFlush(superAdmin);
        log.info("Super Admin bootstrap: created Super Admin \"{}\" <{}>.", name, email);

        auditLogService.record(AuditAction.USER_CREATED, "USER", superAdmin.getId(),
                "Super Admin account created by the bootstrap initializer");

        if (generated) {
            log.warn("Super Admin bootstrap: SUPER_ADMIN_PASSWORD was not set, so a password was generated "
                    + "for \"{}\". Sign in with it now, then set SUPER_ADMIN_PASSWORD in the "
                    + "environment and change the password. It will not be shown again: {}",
                    email, password);
        } else {
            log.info("Super Admin bootstrap: SUPER_ADMIN_PASSWORD was supplied and was not logged.");
        }
    }

    private String resolveEmail() {
        if (hasText(superAdminEmail)) {
            return superAdminEmail.trim();
        }
        // No SUPER_ADMIN_EMAIL configured. Derive a stable, clearly-marked local
        // address rather than inventing one that could collide with a real
        // mailbox; the operator must still set SUPER_ADMIN_EMAIL to sign in remotely.
        String local = slug(resolveName());
        log.warn("Super Admin bootstrap: SUPER_ADMIN_EMAIL is not set. Using the placeholder address {}. "
                + "Set SUPER_ADMIN_EMAIL before first sign-in.", local);
        return local + "@clinic.local";
    }

    private String resolveName() {
        return hasText(superAdminName) ? superAdminName.trim() : "Super Admin";
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String slug(String value) {
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", ".").replaceAll("^\\.|\\.$", "");
    }

    /**
     * 24 random bytes from {@link SecureRandom}, rendered so the result satisfies
     * {@link PasswordPolicy} (upper, lower, digit, symbol, length).
     */
    private String generatePassword() {
        final String upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        final String lower = "abcdefghijkmnopqrstuvwxyz";
        final String digits = "23456789";
        final String symbols = "!@#$%^&*-_=+";
        final String all = upper + lower + digits + symbols;

        StringBuilder password = new StringBuilder(24);
        password.append(upper.charAt(RANDOM.nextInt(upper.length())));
        password.append(lower.charAt(RANDOM.nextInt(lower.length())));
        password.append(digits.charAt(RANDOM.nextInt(digits.length())));
        password.append(symbols.charAt(RANDOM.nextInt(symbols.length())));
        while (password.length() < 24) {
            password.append(all.charAt(RANDOM.nextInt(all.length())));
        }

        // Fisher-Yates with the same SecureRandom instance.
        char[] chars = password.toString().toCharArray();
        for (int i = chars.length - 1; i > 0; i--) {
            int j = RANDOM.nextInt(i + 1);
            char tmp = chars[i];
            chars[i] = chars[j];
            chars[j] = tmp;
        }
        return new String(chars);
    }
}