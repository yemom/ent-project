package com.clinic.entity;

import java.util.List;

/**
 * User roles for role-based access control.
 *
 * <p>HOSPITAL_ADMIN, NURSE, RECEPTIONIST, LAB_TECHNICIAN and CASHIER were added
 * for the front-desk and hospital-operations split. ADMIN and LABORATORY are
 * retained because existing rows and already-issued JWTs still carry them;
 * {@link #canonical} maps them onto the new names so behaviour is unchanged.
 */
public enum UserRole {
    SUPER_ADMIN("SUPER_ADMIN"),
    HOSPITAL_ADMIN("HOSPITAL_ADMIN"),
    ADMIN("ADMIN"),
    DOCTOR("DOCTOR"),
    NURSE("NURSE"),
    RECEPTIONIST("RECEPTIONIST"),
    PATIENT("PATIENT"),
    PHARMACIST("PHARMACIST"),
    LAB_TECHNICIAN("LAB_TECHNICIAN"),
    CASHIER("CASHIER"),
    LABORATORY("LABORATORY");

    private final String value;

    UserRole(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    /** Role used for permission lookups, collapsing the legacy aliases. */
    public UserRole canonical() {
        return switch (this) {
            case ADMIN -> SUPER_ADMIN;
            case LABORATORY -> LAB_TECHNICIAN;
            default -> this;
        };
    }

    public static List<String> allValues() {
        return java.util.Arrays.stream(values()).map(UserRole::getValue).toList();
    }

    public static List<String> storedValues() {
        return java.util.Arrays.stream(values()).map(UserRole::getValue).toList();
    }
}