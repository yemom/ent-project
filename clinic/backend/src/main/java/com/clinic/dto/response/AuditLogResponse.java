package com.clinic.dto.response;

import com.clinic.entity.AuditLog;

import java.time.Instant;

public record AuditLogResponse(
        String id,
        String actorId,
        String actorEmail,
        String actorRole,
        String action,
        String targetType,
        String targetId,
        String branchId,
        String reason,
        String ipAddress,
        Instant createdAt
) {
    public static AuditLogResponse from(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getActorId(),
                log.getActorEmail(),
                log.getActorRole() != null ? log.getActorRole().name() : null,
                log.getAction() != null ? log.getAction().name() : null,
                log.getTargetType(),
                log.getTargetId(),
                log.getBranchId(),
                log.getReason(),
                log.getIpAddress(),
                log.getCreatedAt() != null ? log.getCreatedAt().atZone(java.time.ZoneOffset.UTC).toInstant() : null
        );
    }
}