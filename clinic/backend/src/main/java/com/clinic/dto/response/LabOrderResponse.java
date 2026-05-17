package com.clinic.dto.response;

import com.clinic.entity.LabOrderStatus;
import com.clinic.entity.LabUrgency;
import java.time.LocalDateTime;
import java.util.List;

public record LabOrderResponse(
        String id,
        String patientId,
        String patientName,
        String doctorId,
        String doctorName,
        String appointmentId,
        List<String> tests,
        LabUrgency urgency,
        String clinicalNotes,
        LabOrderStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
