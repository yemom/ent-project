package com.clinic.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record RoomUpsertRequest(
        @NotNull(message = "Ward is required")
        String wardId,

        @NotBlank(message = "Room name is required")
        @Size(max = 100) String name,

        @Size(max = 40) String roomType,

        @Positive(message = "Capacity must be positive")
        Integer capacity,

        String status
) {
}