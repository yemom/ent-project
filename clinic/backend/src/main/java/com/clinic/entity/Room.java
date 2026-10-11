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
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/**
 * A room/bed inside a ward.
 */
@Entity
@Table(name = "rooms", indexes = {
        @Index(name = "idx_rooms_ward", columnList = "ward_id"),
        @Index(name = "idx_rooms_status", columnList = "status")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
public class Room extends BaseEntity {

    public enum Status {
        AVAILABLE,
        OCCUPIED,
        MAINTENANCE
    }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ward_id", nullable = false)
    private Ward ward;

    @NotBlank(message = "Room name is required")
    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Builder.Default
    @Column(name = "room_type", nullable = false, length = 40)
    private String roomType = "GENERAL";

    @Positive(message = "Capacity must be positive")
    @Builder.Default
    @Column(name = "capacity", nullable = false)
    private Integer capacity = 1;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(name = "status", nullable = false, length = 20)
    private Status status = Status.AVAILABLE;
}