package com.clinic.dto.response;

import com.clinic.entity.NurseObservation;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record NurseObservationResponse(
        String id,
        String patientId,
        String patientName,
        String recordedById,
        String recordedByName,
        String kind,
        String bloodPressure,
        Integer heartRate,
        BigDecimal temperatureC,
        Integer respiratoryRate,
        BigDecimal oxygenSaturation,
        BigDecimal weightKg,
        String medication,
        String dose,
        String notes,
        LocalDateTime observedAt
) {
    public static NurseObservationResponse from(NurseObservation observation) {
        return new NurseObservationResponse(
                observation.getId(),
                observation.getPatient() != null ? observation.getPatient().getId() : null,
                observation.getPatient() != null ? observation.getPatient().getFullName() : null,
                observation.getRecordedById(),
                observation.getRecordedByName(),
                observation.getKind() != null ? observation.getKind().name() : null,
                observation.getBloodPressure(),
                observation.getHeartRate(),
                observation.getTemperatureC(),
                observation.getRespiratoryRate(),
                observation.getOxygenSaturation(),
                observation.getWeightKg(),
                observation.getMedication(),
                observation.getDose(),
                observation.getNotes(),
                observation.getObservedAt()
        );
    }
}