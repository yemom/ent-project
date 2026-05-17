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
import java.util.ArrayList;
import java.util.List;

/**
 * Laboratory entity representing a laboratory facility in the clinic.
 *
 * Relationships:
 * - OneToMany with LabOrder (a laboratory can have multiple lab orders)
 * - OneToMany with DoctorAvailability (doctors have availability schedules per laboratory)
 *
 * Fields: name, location, phone, email, status, operatingHoursStart, operatingHoursEnd, equipment
 */
@Entity
@Table(name = "laboratories", indexes = {
        @Index(name = "idx_lab_name", columnList = "name"),
        @Index(name = "idx_lab_status", columnList = "status")
})
@SQLDelete(sql = "UPDATE laboratories SET deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
@SQLRestriction("deleted = false")
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@Builder
public class Laboratory extends BaseEntity {

    @NotNull(message = "Laboratory name is required")
    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @NotNull(message = "Location is required")
    @Column(name = "location", nullable = false, length = 500)
    private String location;

    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "email", length = 255)
    private String email;

    @NotNull(message = "Status is required")
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "operating_hours_start", length = 10)
    private String operatingHoursStart;

    @Column(name = "operating_hours_end", length = 10)
    private String operatingHoursEnd;

    @Column(name = "equipment", columnDefinition = "text")
    private String equipment;

    @Column(name = "capacity")
    private Integer capacity;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @OneToMany(mappedBy = "laboratory", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<DoctorAvailability> doctorAvailabilities = new ArrayList<>();

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
