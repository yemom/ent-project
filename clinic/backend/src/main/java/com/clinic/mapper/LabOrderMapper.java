package com.clinic.mapper;

import com.clinic.dto.request.CreateLabOrderRequest;
import com.clinic.dto.response.LabOrderResponse;
import com.clinic.entity.LabOrder;
import com.clinic.entity.LabUrgency;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Component
public class LabOrderMapper {

    public LabOrder toEntity(CreateLabOrderRequest request) {
        return LabOrder.builder()
                .id(UUID.randomUUID().toString())
                .patientId(request.patientId())
                .doctorId(request.doctorId())
                .appointmentId(request.appointmentId())
                .tests(request.tests())
                .urgency(LabUrgency.valueOf(request.urgency().toUpperCase()))
                .clinicalNotes(request.clinicalNotes())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    public LabOrderResponse toResponse(LabOrder entity) {
        return toResponse(entity, Map.of());
    }

    public LabOrderResponse toResponse(LabOrder entity, Map<String, String> userNamesById) {
        String patientName = userNamesById.getOrDefault(entity.getPatientId(), entity.getPatientId());
        String doctorName = userNamesById.getOrDefault(entity.getDoctorId(), "Unknown Doctor");

        return new LabOrderResponse(
                entity.getId(),
                entity.getPatientId(),
                patientName,
                entity.getDoctorId(),
                doctorName,
                entity.getAppointmentId(),
                entity.getTests() != null ? new java.util.ArrayList<>(entity.getTests()) : java.util.Collections.emptyList(),
                entity.getUrgency(),
                entity.getClinicalNotes(),
                entity.getStatus(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
