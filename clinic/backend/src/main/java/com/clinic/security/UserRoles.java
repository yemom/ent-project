package com.clinic.security;

import com.clinic.entity.UserRole;

import java.util.List;

/**
 * Role helpers shared by the services that provision accounts.
 *
 * <p>The {@code users} table uses single-table inheritance, so {@code user_type}
 * comes from the entity class, not from {@code role}. Staff roles that share no
 * extra columns (HOSPITAL_ADMIN, NURSE, RECEPTIONIST, CASHIER) are therefore
 * persisted as {@code AdminUser}, which maps to the existing
 * {@code user_type = 'ADMIN'} discriminator — no schema change needed.
 */
public final class UserRoles {

    /** Roles that can never hold a SUPER_ADMIN grant without dual approval. */
    public static final List<UserRole> PRIVILEGED = List.of(
            UserRole.SUPER_ADMIN,
            UserRole.ADMIN,
            UserRole.HOSPITAL_ADMIN
    );

    private UserRoles() {
    }

    public static boolean isPrivileged(UserRole role) {
        return role != null && PRIVILEGED.contains(role);
    }

    public static boolean isClinical(UserRole role) {
        return role == UserRole.DOCTOR || role == UserRole.NURSE;
    }
}