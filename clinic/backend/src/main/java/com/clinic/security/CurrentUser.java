package com.clinic.security;

import com.clinic.entity.UserRole;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Derives the acting principal's identity and role from the security context
 * (which the JWT filter populated). Services use this instead of trusting
 * user/role/patient ids supplied by the client.
 */
@Component
public class CurrentUser {

    public CustomUserPrincipal require() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof CustomUserPrincipal principal)) {
            throw new org.springframework.security.access.AccessDeniedException("No authenticated principal");
        }
        return principal;
    }

    public String userId() {
        return require().getUser().getId();
    }

    /**
     * The acting principal's id, or {@code null} when there is none.
     *
     * <p>For code that must work both interactively and on behalf of the system —
     * a scheduled reminder, a notification fan-out — and cannot simply assume an
     * authenticated caller. Use {@link #userId()} wherever a missing principal
     * should be an error; this method exists so that "nobody is acting" is a value
     * to handle rather than an exception to swallow.
     */
    public String tryGetUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof CustomUserPrincipal principal)) {
            return null;
        }
        return principal.getUser().getId();
    }

    public UserRole role() {
        return require().getUser().getRole();
    }

    public boolean is(UserRole role) {
        return role() == role;
    }

    public boolean isAny(UserRole... roles) {
        UserRole current = role();
        for (UserRole candidate : roles) {
            if (current == candidate) {
                return true;
            }
        }
        return false;
    }

    /** Roles an admin-level user is allowed to act as, used by the RBAC guards. */
    public boolean isSuperAdmin() {
        return role() == UserRole.SUPER_ADMIN || role() == UserRole.ADMIN;
    }

    /**
     * The branch the caller belongs to, or null for a platform-level admin.
     *
     * <p>Services pass this into every scoped query so one branch never sees
     * another's records. It is read from the JWT-backed user row, never from the
     * request body or a query parameter.
     */
    public String branchId() {
        return require().getUser().getBranchId();
    }

    /**
     * True when the caller is scoped to a branch. A false value means the caller
     * sees every branch (platform super admin) rather than "no filter due to a
     * missing value".
     */
    public boolean isBranchScoped() {
        String branchId = branchId();
        return branchId != null && !branchId.isBlank();
    }
}