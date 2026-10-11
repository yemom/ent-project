package com.clinic.dto.response;

import com.clinic.entity.LabResultStatus;
import java.time.LocalDateTime;

public record LabResultResponse(
        String id,
        LabOrderResponse labOrder,
        String labTechnicianId,
        String findings,
        String fileUrl,
        LabResultStatus status,
        /** Whether the technician flagged this result as clinically critical. */
        boolean critical,
        LocalDateTime submittedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
