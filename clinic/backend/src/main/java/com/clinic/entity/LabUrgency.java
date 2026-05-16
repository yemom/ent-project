package com.clinic.entity;

/**
 * Lab Urgency enum
 */
public enum LabUrgency {
    ROUTINE("ROUTINE"),
    URGENT("URGENT"),
    CRITICAL("CRITICAL");

    private final String value;

    LabUrgency(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
