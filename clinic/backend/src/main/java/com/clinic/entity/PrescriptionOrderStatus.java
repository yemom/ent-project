package com.clinic.entity;

/**
 * Prescription order status enumeration
 */
public enum PrescriptionOrderStatus {
    PENDING("PENDING"),
    DISPENSED("DISPENSED"),
    REJECTED("REJECTED");

    private final String value;

    PrescriptionOrderStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
