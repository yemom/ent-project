package com.clinic.dto.request;

public record UpdatePrescriptionOrderRequest(
        String patientName,
        String drugName,
        String dosage,
        String instructions
) {
}
