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
        /**
         * Front-desk registration number.
         *
         * <p>Added so the patient directory can be searched and disambiguated by the
         * identifier the front desk actually quotes to callers. It was previously
         * only visible on {@link PatientDemographicsResponse}, which meant opening a
         * directory row and making a second request just to learn which patient it
         * was.
         */
        String registrationNumber,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
