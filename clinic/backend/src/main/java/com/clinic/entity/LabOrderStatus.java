package com.clinic.entity;

/**
 * Lab Order Status enum
 */
public enum LabOrderStatus {
    PENDING("PENDING"),
    IN_PROGRESS("IN_PROGRESS"),
    COMPLETED("COMPLETED"),
    CANCELLED("CANCELLED");

    private final String value;

    LabOrderStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
