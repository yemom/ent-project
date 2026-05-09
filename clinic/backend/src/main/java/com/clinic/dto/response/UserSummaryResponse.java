package com.clinic.dto.response;

import com.clinic.entity.UserRole;

import java.util.UUID;

public record UserSummaryResponse(
        UUID id,
        String fullName,
        String email,
        UserRole role
) {
}
