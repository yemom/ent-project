package com.clinic.dto.response;

import com.clinic.entity.UserRole;
import java.time.LocalDateTime;
import java.math.BigDecimal;

public record DoctorResponse(
        String id,
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
