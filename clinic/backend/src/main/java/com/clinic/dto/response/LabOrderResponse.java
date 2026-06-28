package com.clinic.dto.response;

import com.clinic.entity.LabOrderStatus;
import com.clinic.entity.LabUrgency;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;

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
        @JsonSerialize(using = LocalDateTimeSerializer.class)
        @JsonDeserialize(using = LocalDateTimeDeserializer.class)
        LocalDateTime createdAt,
        @JsonSerialize(using = LocalDateTimeSerializer.class)
        @JsonDeserialize(using = LocalDateTimeDeserializer.class)
        LocalDateTime updatedAt) {
}