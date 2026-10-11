package com.clinic.dto.response;

import com.clinic.entity.RoleChangeRequest;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

public record RoleChangeRequestResponse(
        String id,
        String targetUserId,
        String targetUserEmail,
        String currentRole,
        String requestedRole,
        String status,
        String requestedById,
        String requestedByEmail,
        String approvedById,
        String approvedByEmail,
        String reason,
        String decisionReason,
        Instant requestedAt,
        Instant decidedAt
) {
    public static RoleChangeRequestResponse from(RoleChangeRequest request) {
        return new RoleChangeRequestResponse(
                request.getId(),
                request.getTargetUserId(),
                request.getTargetUserEmail(),
                request.getCurrentRole() != null ? request.getCurrentRole().name() : null,
                request.getRequestedRole() != null ? request.getRequestedRole().name() : null,
                request.getStatus() != null ? request.getStatus().name() : null,
                request.getRequestedById(),
                request.getRequestedByEmail(),
                request.getApprovedById(),
                request.getApprovedByEmail(),
                request.getReason(),
                request.getDecisionReason(),
                toInstant(request.getRequestedAt()),
                toInstant(request.getDecidedAt())
        );
    }

    private static Instant toInstant(LocalDateTime value) {
        return value != null ? value.atZone(ZoneOffset.UTC).toInstant() : null;
    }
}