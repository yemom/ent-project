package com.clinic.dto.request;

import jakarta.validation.constraints.Size;

/**
 * Check-in / queue manipulation at the front desk.
 * All fields are optional: omitting them clears the corresponding state.
 */
public record CheckInPatientRequest(
        Boolean checkedIn,
        Integer queuePosition,
        @Size(max = 500, message = "Notes must not exceed 500 characters")
        String notes
) {
}