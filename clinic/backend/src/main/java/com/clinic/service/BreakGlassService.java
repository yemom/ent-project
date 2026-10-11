package com.clinic.service;

import com.clinic.security.CurrentUser;
import com.clinic.entity.AuditAction;
import com.clinic.service.AuditLogService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Emergency "break-glass" record access.
 *
 * <p>Access outside your assigned panel is possible but never silent: the caller
 * must supply a reason, and the attempt is written to the immutable audit log with
 * the actor, target and reason.
 */
@Service
@Slf4j
public class BreakGlassService {

    private final AuditLogService auditLogService;
    private final CurrentUser currentUser;

    public BreakGlassService(AuditLogService auditLogService, CurrentUser currentUser) {
        this.auditLogService = auditLogService;
        this.currentUser = currentUser;
    }

    /**
     * Records an emergency-access event. Bean validation on the request DTO
     * guarantees a non-blank reason reached this point.
     */
    public void recordAccess(String medicalRecordId, String reason) {
        String actor = currentUser.require().getUsername();
        log.warn("BREAK-GLASS access by {} to medical record {}: {}", actor, medicalRecordId, reason);
        auditLogService.record(AuditAction.BREAK_GLASS_ACCESS, "MEDICAL_RECORD", medicalRecordId, reason);
    }
}