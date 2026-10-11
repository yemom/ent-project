package com.clinic.dto.response;

import com.clinic.entity.MedicalRecordAmendment;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

public record MedicalRecordAmendmentResponse(
        String id,
        String medicalRecordId,
        String amendedById,
        String amendedByName,
        String reason,
        List<String> fields,
        String previousValues,
        String newValues,
        Instant amendedAt,
        Instant createdAt
) {
    public static MedicalRecordAmendmentResponse from(MedicalRecordAmendment amendment) {
        return new MedicalRecordAmendmentResponse(
                amendment.getId(),
                amendment.getMedicalRecordId(),
                amendment.getAmendedById(),
                amendment.getAmendedByName(),
                amendment.getReason(),
                amendment.getFields() != null ? List.copyOf(amendment.getFields()) : List.of(),
                amendment.getPreviousValues(),
                amendment.getNewValues(),
                toInstant(amendment.getAmendedAt()),
                toInstant(amendment.getCreatedAt())
        );
    }

    private static Instant toInstant(LocalDateTime value) {
        return value != null ? value.atZone(ZoneOffset.UTC).toInstant() : null;
    }
}