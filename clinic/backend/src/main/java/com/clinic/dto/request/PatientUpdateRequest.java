package com.clinic.dto.request;

import com.clinic.entity.Gender;

import java.time.LocalDate;

public record PatientUpdateRequest(
        String fullName,
        String phone,
        LocalDate dateOfBirth,
        Gender gender,
        String medicalHistory,
        String bloodType,
        String allergies,
        String emergencyContactName,
        String emergencyContactPhone,
        Boolean active
) {
}
