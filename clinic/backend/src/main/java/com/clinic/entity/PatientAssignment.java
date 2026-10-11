package com.clinic.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Index;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

/**
 * Assignment of a patient to a doctor.
 *
 * <p>This is what makes "a doctor sees only patients assigned to them"
 * enforceable: the read path filters on this table instead of trusting a
 * patientId supplied by the client.
 *
 * <p>Rows are historical — releasing an assignment sets {@link #releasedAt}
 * rather than deleting the row, so the care chain stays auditable.
 */
@Entity
@Table(name = "patient_assignments", indexes = {
        @Index(name = "idx_patient_assignments_patient", columnList = "patient_id, released_at"),
        @Index(name = "idx_patient_assignments_doctor", columnList = "doctor_id, released_at"),
        @Index(name = "idx_patient_assignments_department", columnList = "department_id, released_at"),
        @Index(name = "idx_patient_assignments_nurse", columnList = "nurse_id, released_at")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public class PatientAssignment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    /**
     * Nurse responsible for this patient, if the front desk named one.
     *
     * <p>A plain id rather than a relation, because {@link com.clinic.entity.User}
     * is a single-table hierarchy and a FK to it would constrain the whole
     * hierarchy from a leaf table. Validated against the user table in the service.
     *
     * <p>Nullable on purpose: a patient may be assigned to a doctor before a nurse
     * is allocated, and the doctor panel must not depend on a nurse being present.
     */
    @Column(name = "nurse_id", length = 36)
    private String nurseId;

    /** Department used to pick a suitable doctor at assignment time. */
    @Column(name = "department_id", length = 36)
    private String departmentId;

    /** Queue position for the front desk; lower sorts first. */
    @Column(name = "queue_position")
    private Integer queuePosition;

    @Column(name = "assigned_by_id", length = 36)
    private String assignedById;

    @Column(name = "assigned_by_name", length = 100)
    private String assignedByName;

    @Column(name = "assigned_at", nullable = false)
    private LocalDateTime assignedAt;

    /** Null while the assignment is active. */
    @Column(name = "released_at")
    private LocalDateTime releasedAt;

    @Column(name = "reason", length = 500)
    private String reason;

    public boolean isActive() {
        return releasedAt == null;
    }

    public void release() {
        if (releasedAt == null) {
            releasedAt = LocalDateTime.now();
        }
    }
}