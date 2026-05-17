package com.clinic.dto.response;

import java.time.LocalDateTime;

public record LaboratoryResponse(
        String id,
        String name,
        String location,
        String phone,
        String email,
        String status,
        String operatingHoursStart,
        String operatingHoursEnd,
        String equipment,
        Integer capacity,
        String description,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
