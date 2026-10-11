package com.clinic.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Records a nursing observation.
 *
 * <p>Validation is deliberately permissive per-kind: vitals fields are optional
 * for a nursing note and a note is optional for a vitals row. Requiring all of
 * them would force nurses to type placeholder values, which is how bad data gets
 * into a clinical record.
 */
public record NurseObservationRequest(
        @NotNull(message = "Patient is required")
        String patientId,

        @NotNull(message = "Observation type is required")
        String kind,

        @Size(max = 20, message = "Blood pressure must look like 120/80")
        String bloodPressure,

        @Positive(message = "Heart rate must be positive")
        Integer heartRate,

        @DecimalMin(value = "20.0", message = "Temperature looks implausible")
        @Digits(integer = 2, fraction = 1)
        BigDecimal temperatureC,

        @Positive(message = "Respiratory rate must be positive")
        Integer respiratoryRate,

        @DecimalMin(value = "0.0")
        @Digits(integer = 3, fraction = 2)
        BigDecimal oxygenSaturation,

        @DecimalMin(value = "0.0")
        @Digits(integer = 4, fraction = 2)
        BigDecimal weightKg,

        @Size(max = 200, message = "Medication name must not exceed 200 characters")
        String medication,

        @Size(max = 100, message = "Dose must not exceed 100 characters")
        String dose,

        @Size(max = 4000, message = "Notes must not exceed 4000 characters")
        String notes
) {
}