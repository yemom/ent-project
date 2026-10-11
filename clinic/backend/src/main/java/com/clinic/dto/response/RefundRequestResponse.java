package com.clinic.dto.response;

import com.clinic.entity.RefundRequest;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

public record RefundRequestResponse(
        String id,
        String invoiceId,
        BigDecimal amount,
        boolean requiresApproval,
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
    public static RefundRequestResponse from(RefundRequest request) {
        return new RefundRequestResponse(
                request.getId(),
                request.getInvoiceId(),
                request.getAmount(),
                Boolean.TRUE.equals(request.getRequiresApproval()),
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