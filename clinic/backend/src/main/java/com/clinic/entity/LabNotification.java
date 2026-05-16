package com.clinic.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.SuperBuilder;

/**
 * Lab Notification entity for notifying doctors when lab results are ready.
 * 
 * Fields: id, userId, type, message, labOrderId, labResultId, isRead, createdAt
 */
@Entity
@Table(name = "lab_notifications", indexes = {
        @Index(name = "idx_user_id", columnList = "user_id"),
        @Index(name = "idx_is_read", columnList = "is_read")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public class LabNotification extends BaseEntity {

    @NotNull(message = "User ID is required")
    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "type", nullable = false, length = 50)
    @Builder.Default
    private String type = "lab_result_ready";

    @NotBlank(message = "Message is required")
    @Column(name = "message", columnDefinition = "TEXT", nullable = false)
    private String message;

    @Column(name = "lab_order_id")
    private String labOrderId;

    @Column(name = "lab_result_id")
    private String labResultId;

    @Column(name = "is_read", nullable = false)
    @Builder.Default
    private Boolean isRead = false;
}
