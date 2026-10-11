package com.clinic.dto.response;

import java.time.LocalDate;

public record PatientDemographicsResponse(
        String id,
        String registrationNumber,
        String fullName,
        String email,
        String phone,
        LocalDate dateOfBirth,
        String gender,
        String bloodType,
        String emergencyContactName,
        String emergencyContactPhone,
        String branchId,
        boolean checkedIn,
        String checkedInAt,
        String assignedDoctorId,
        String assignedDoctorName
) {
}