package com.clinic.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Category of audit activity. Recorded so audit queries do not depend on
 * free-text action strings.
 */
public enum AuditAction {
    LOGIN_SUCCESS,
    LOGIN_FAILED,
    LOGOUT,
    TOKEN_REFRESH,
    RECORD_VIEWED,
    RECORD_CREATED,
    RECORD_AMENDED,
    PATIENT_ASSIGNED,
    ROLE_CHANGED,
    ROLE_CHANGE_REQUESTED,
    ROLE_CHANGE_APPROVED,
    REFUND_ISSUED,
    REFUND_REQUESTED,
    REFUND_APPROVED,
    BREAK_GLASS_ACCESS,
    SETTINGS_CHANGED,
    USER_CREATED,
    USER_UPDATED,
    USER_DELETED,
    USER_ACTIVATED,
    USER_DEACTIVATED,
    USER_PASSWORD_RESET;

    @JsonValue
    public String getValue() {
        return name();
    }

    @JsonCreator
    public static AuditAction from(String value) {
        if (value == null) {
            return null;
        }
        try {
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}