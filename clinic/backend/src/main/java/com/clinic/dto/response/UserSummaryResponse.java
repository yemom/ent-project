package com.clinic.dto.response;

import com.clinic.entity.UserRole;

public record UserSummaryResponse(
        String id,
        String fullName,
        String email,
        UserRole role,
        Boolean active
) {
}
