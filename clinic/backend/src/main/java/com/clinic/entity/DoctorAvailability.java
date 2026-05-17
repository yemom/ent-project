package com.clinic.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * DoctorAvailability entity representing a doctor's availability schedule in a laboratory.
 *
 * Relationships:
 * - ManyToOne with Doctor (a doctor has multiple availabilities)
 * - ManyToOne with Laboratory (an availability is for a specific laboratory)
 *
 * Fields: doctor, laboratory, dayOfWeek, startTime, endTime, isAvailable, maxPatients
 */
@Entity
@Table(name = "doctor_availability", indexes = {
        @Index(name = "idx_doctor_id_avail", columnList = "doctor_id"),
        @Index(name = "idx_lab_id_avail", columnList = "laboratory_id"),
        @Index(name = "idx_day_of_week", columnList = "day_of_week")
})
@SQLDelete(sql = "UPDATE doctor_availability SET deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@SQLRestriction("deleted = false")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Builder
public class DoctorAvailability extends BaseEntity {

    @NotNull(message = "Doctor is required")
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "doctor_id", nullable = false, foreignKey = @ForeignKey(name = "fk_availability_doctor"))
    private Doctor doctor;

    @NotNull(message = "Laboratory is required")
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "laboratory_id", nullable = false, foreignKey = @ForeignKey(name = "fk_availability_laboratory"))
    private Laboratory laboratory;

    @NotNull(message = "Day of week is required")
    @Column(name = "day_of_week", nullable = false, length = 10)
    private String dayOfWeek; // MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY

    @NotNull(message = "Start time is required")
    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @NotNull(message = "End time is required")
    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "is_available", nullable = false)
    @Builder.Default
    private Boolean isAvailable = true;

    @Column(name = "max_patients")
    private Integer maxPatients;

    @Column(name = "notes", columnDefinition = "text")
    private String notes;

    @Column(name = "deleted", nullable = false)
    @Builder.Default
    private Boolean deleted = false;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
