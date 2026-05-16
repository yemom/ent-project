package com.clinic.mapper;

import com.clinic.dto.request.CreateLabOrderRequest;
import com.clinic.dto.response.LabOrderResponse;
import com.clinic.entity.LabOrder;
import com.clinic.entity.LabUrgency;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
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
        return new LabOrderResponse(
                entity.getId(),
                entity.getPatientId(),
                entity.getDoctorId(),
                entity.getAppointmentId(),
                entity.getTests(),
                entity.getUrgency(),
                entity.getClinicalNotes(),
                entity.getStatus(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
