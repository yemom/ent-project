package com.clinic.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

/**
 * An inpatient admission tying a patient to a ward/room and a responsible
 * doctor. Admitted_at is set on persist; discharged_at only when the status says
 * so, which keeps an open admission unambiguous.
 */
@Entity
@Table(name = "admissions", indexes = {
        @Index(name = "idx_admissions_patient", columnList = "patient_id, status"),
        @Index(name = "idx_admissions_status", columnList = "status, admitted_at DESC"),
        @Index(name = "idx_admissions_ward", columnList = "ward_id")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public class Admission extends BaseEntity {

    public enum Status {
        ADMITTED,
        DISCHARGED,
        TRANSFERRED
    }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "doctor_id")
    private Doctor doctor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ward_id")
    private Ward ward;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "room_id")
    private Room room;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "status", nullable = false, length = 20)
    private Status status = Status.ADMITTED;

    @Column(name = "admitted_at", nullable = false)
    private LocalDateTime admittedAt;

    @Column(name = "discharged_at")
    private LocalDateTime dischargedAt;

    @Column(name = "diagnosis", length = 500)
    private String diagnosis;

    @Column(name = "notes", columnDefinition = "text")
    private String notes;

    public boolean isOpen() {
        return status == Status.ADMITTED;
    }

    public void discharge() {
        this.status = Status.DISCHARGED;
        this.dischargedAt = LocalDateTime.now();
    }
}