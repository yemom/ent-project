package com.clinic.dto.response;

import com.clinic.entity.PatientAssignment;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

public record PatientAssignmentResponse(
        String id,
        String patientId,
        String patientName,
        String doctorId,
        String doctorName,
        String nurseId,
        String departmentId,
        Integer queuePosition,
        String assignedById,
        String assignedByName,
        String reason,
        boolean active,
        Instant assignedAt,
        Instant releasedAt
) {
    public static PatientAssignmentResponse from(PatientAssignment assignment) {
        return new PatientAssignmentResponse(
                assignment.getId(),
                assignment.getPatient() != null ? assignment.getPatient().getId() : null,
                assignment.getPatient() != null ? assignment.getPatient().getFullName() : null,
                assignment.getDoctor() != null ? assignment.getDoctor().getId() : null,
                assignment.getDoctor() != null ? assignment.getDoctor().getFullName() : null,
                assignment.getNurseId(),
                assignment.getDepartmentId(),
                assignment.getQueuePosition(),
                assignment.getAssignedById(),
                assignment.getAssignedByName(),
                assignment.getReason(),
                assignment.isActive(),
                toInstant(assignment.getAssignedAt()),
                toInstant(assignment.getReleasedAt())
        );
    }

    private static Instant toInstant(LocalDateTime value) {
        return value != null ? value.atZone(ZoneOffset.UTC).toInstant() : null;
    }
}