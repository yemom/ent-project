package com.clinic.dto.response;

import com.clinic.entity.Gender;
import com.clinic.entity.UserRole;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record PatientResponse(
        String id,
        String email,
        String fullName,
        String phone,
        UserRole role,
        LocalDate dateOfBirth,
        Gender gender,
        String medicalHistory,
        String bloodType,
        String allergies,
        String emergencyContactName,
        String emergencyContactPhone,
        Boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
