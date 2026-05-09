package com.clinic.entity;

/**
 * Appointment status enumeration
 */
public enum AppointmentStatus {
    SCHEDULED("SCHEDULED"),
    CONFIRMED("CONFIRMED"),
    COMPLETED("COMPLETED"),
    CANCELLED("CANCELLED"),
    NO_SHOW("NO_SHOW");

    private final String value;

    AppointmentStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
