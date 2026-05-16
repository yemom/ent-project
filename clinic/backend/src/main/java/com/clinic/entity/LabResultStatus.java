package com.clinic.entity;

/**
 * Lab Result Status enum
 */
public enum LabResultStatus {
    DRAFT("DRAFT"),
    FINAL("FINAL");

    private final String value;

    LabResultStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
