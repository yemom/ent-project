package com.clinic.mapper;

import com.clinic.dto.response.LabNotificationResponse;
import com.clinic.entity.LabNotification;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.UUID;

@Component
public class LabNotificationMapper {

    public LabNotification toEntity(String userId, String labOrderId, String labResultId, String message) {
        return LabNotification.builder()
                .id(UUID.randomUUID().toString())
                .userId(userId)
                .type("lab_result_ready")
                .message(message)
                .labOrderId(labOrderId)
                .labResultId(labResultId)
                .isRead(false)
                .createdAt(LocalDateTime.now())
                .build();
    }

    public LabNotificationResponse toResponse(LabNotification entity) {
        return new LabNotificationResponse(
                entity.getId(),
                entity.getUserId(),
                entity.getType(),
                entity.getMessage(),
                entity.getLabOrderId(),
                entity.getLabResultId(),
                entity.getIsRead(),
                entity.getCreatedAt()
        );
    }
}
