package com.clinic.dto.response;

import com.clinic.entity.UserRole;
import java.time.LocalDateTime;
import java.util.UUID;
import java.math.BigDecimal;

public record DoctorResponse(
        UUID id,
        String email,
        String fullName,
        String phone,
        UserRole role,
        String specialization,
        String licenseNumber,
        Integer yearsOfExperience,
        String qualifications,
        BigDecimal consultationFee,
        String bio,
        Boolean active,
        Boolean available,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
