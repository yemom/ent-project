package com.clinic.dto.response;

import com.clinic.entity.PrescriptionOrderStatus;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

public record PrescriptionOrderResponse(
        String id,

        @JsonProperty("doctorId")
        String doctorId,

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
