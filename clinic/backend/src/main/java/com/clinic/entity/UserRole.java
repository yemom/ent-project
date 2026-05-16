package com.clinic.entity;

/**
 * User roles for role-based access control
 */
public enum UserRole {
    ADMIN("ADMIN"),
    DOCTOR("DOCTOR"),
    PATIENT("PATIENT"),
    PHARMACIST("PHARMACIST"),
    LABORATORY("LABORATORY");

    private final String value;

    UserRole(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
