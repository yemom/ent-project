package com.clinic.dto.response;

import com.clinic.entity.PrescriptionOrderStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;
import java.util.UUID;

public record PrescriptionOrderResponse(
        UUID id,

        @JsonProperty("doctorId")
        UUID doctorId,

        @JsonProperty("doctorName")
        String doctorName,

        @JsonProperty("patientName")
        String patientName,

        @JsonProperty("drugName")
        String drugName,

        String dosage,

        String instructions,

        PrescriptionOrderStatus status,

        @JsonProperty("orderedAt")
        LocalDateTime orderedAt,

        @JsonProperty("dispensedAt")
        LocalDateTime dispensedAt) {
}
