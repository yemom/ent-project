package com.clinic.mapper;

import com.clinic.dto.request.CreatePrescriptionOrderRequest;
import com.clinic.dto.response.PrescriptionOrderResponse;
import com.clinic.entity.PrescriptionOrder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class PrescriptionOrderMapper {

    public PrescriptionOrder toEntity(CreatePrescriptionOrderRequest request) {
        return PrescriptionOrder.builder()
                .doctorId(request.doctorId())
                .doctorName(request.doctorName())
                .patientName(request.patientName())
                .drugName(request.drugName())
                .dosage(request.dosage())
                .instructions(request.instructions())
                .orderedAt(LocalDateTime.now())
                .build();
    }

    public PrescriptionOrderResponse toResponse(PrescriptionOrder entity) {
        return new PrescriptionOrderResponse(
                entity.getId(),
                entity.getDoctorId(),
                entity.getDoctorName(),
                entity.getPatientName(),
                entity.getDrugName(),
                entity.getDosage(),
                entity.getInstructions(),
                entity.getStatus(),
                entity.getOrderedAt(),
                entity.getDispensedAt()
        );
    }
}
