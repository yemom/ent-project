package com.clinic.service;

import com.clinic.entity.AuditAction;
import com.clinic.security.CustomUserPrincipal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Map;

/**
 * Append-only audit trail.
 *
 * <p>Write path is intentionally tiny and never throws into the business flow:
 * an audit failure must not roll back a clinical action, but it is logged loudly.
 * There is no update or delete method — the table rejects both at the database
 * level.
 */
public interface AuditLogService {

    void record(AuditAction action, String targetType, String targetId, String reason);

    void record(AuditAction action, String targetType, String targetId, String reason,
                Map<String, Object> metadata);

    /** Audit entry attributed to an explicit principal (e.g. a failed login). */
    void recordAs(CustomUserPrincipal principal, AuditAction action, String targetType,
                  String targetId, String reason, String ipAddress);

    /** Audit entry for an unauthenticated attempt; the actor is the supplied email. */
    void recordAnonymous(String email, AuditAction action, String targetType,
                         String targetId, String reason, String ipAddress);

    Page<com.clinic.dto.response.AuditLogResponse> list(Pageable pageable);

    Page<com.clinic.dto.response.AuditLogResponse> listByAction(AuditAction action, Pageable pageable);
}