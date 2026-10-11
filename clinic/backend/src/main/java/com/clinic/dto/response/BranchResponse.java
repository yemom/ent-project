package com.clinic.dto.response;

import java.time.LocalDateTime;

public record BranchResponse(
        String id,
        String name,
        String code,
        String address,
        String phone,
        String email,
        String type,
        Boolean active,
        String notes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
