package com.clinic.dto.request;

import java.math.BigDecimal;

public record DoctorUpdateRequest(
        String fullName,
        String phone,
        String specialization,
        String licenseNumber,
        Integer yearsOfExperience,
        String qualifications,
        BigDecimal consultationFee,
        String bio,
        Boolean active,
        Boolean available
) {
}
