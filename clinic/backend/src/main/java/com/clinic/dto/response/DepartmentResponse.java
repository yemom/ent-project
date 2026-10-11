package com.clinic.dto.response;

import com.clinic.entity.Admission;
import com.clinic.entity.Department;
import com.clinic.entity.Room;
import com.clinic.entity.Ward;

import java.time.LocalDateTime;

public record DepartmentResponse(
        String id,
        String name,
        String code,
        String description,
        String headDoctorId,
        boolean active,
        LocalDateTime createdAt
) {
    public static DepartmentResponse from(Department department) {
        return new DepartmentResponse(
                department.getId(),
                department.getName(),
                department.getCode(),
                department.getDescription(),
                department.getHeadDoctorId(),
                Boolean.TRUE.equals(department.getActive()),
                department.getCreatedAt()
        );
    }

    public record WardResponse(
            String id,
            String name,
            String code,
            String floor,
            Integer capacity,
            boolean active,
            String departmentId,
            String departmentName,
            LocalDateTime createdAt
    ) {
        public static WardResponse from(Ward ward) {
            return new WardResponse(
                    ward.getId(),
                    ward.getName(),
                    ward.getCode(),
                    ward.getFloor(),
                    ward.getCapacity(),
                    Boolean.TRUE.equals(ward.getActive()),
                    ward.getDepartment() != null ? ward.getDepartment().getId() : null,
                    ward.getDepartment() != null ? ward.getDepartment().getName() : null,
                    ward.getCreatedAt()
            );
        }
    }

    public record RoomResponse(
            String id,
            String name,
            String roomType,
            Integer capacity,
            String status,
            String wardId,
            String wardName,
            String departmentName,
            LocalDateTime createdAt
    ) {
        public static RoomResponse from(Room room) {
            Ward ward = room.getWard();
            return new RoomResponse(
                    room.getId(),
                    room.getName(),
                    room.getRoomType(),
                    room.getCapacity(),
                    room.getStatus() != null ? room.getStatus().name() : null,
                    ward != null ? ward.getId() : null,
                    ward != null ? ward.getName() : null,
                    ward != null && ward.getDepartment() != null ? ward.getDepartment().getName() : null,
                    room.getCreatedAt()
            );
        }
    }

    public record AdmissionResponse(
            String id,
            String patientId,
            String patientName,
            String doctorId,
            String doctorName,
            String wardId,
            String wardName,
            String roomId,
            String roomName,
            String status,
            String diagnosis,
            String notes,
            LocalDateTime admittedAt,
            LocalDateTime dischargedAt
    ) {
        public static AdmissionResponse from(Admission admission) {
            return new AdmissionResponse(
                    admission.getId(),
                    admission.getPatient() != null ? admission.getPatient().getId() : null,
                    admission.getPatient() != null ? admission.getPatient().getFullName() : null,
                    admission.getDoctor() != null ? admission.getDoctor().getId() : null,
                    admission.getDoctor() != null ? admission.getDoctor().getFullName() : null,
                    admission.getWard() != null ? admission.getWard().getId() : null,
                    admission.getWard() != null ? admission.getWard().getName() : null,
                    admission.getRoom() != null ? admission.getRoom().getId() : null,
                    admission.getRoom() != null ? admission.getRoom().getName() : null,
                    admission.getStatus() != null ? admission.getStatus().name() : null,
                    admission.getDiagnosis(),
                    admission.getNotes(),
                    admission.getAdmittedAt(),
                    admission.getDischargedAt()
            );
        }
    }
}