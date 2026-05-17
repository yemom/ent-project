package com.clinic.mapper;

import com.clinic.dto.request.DoctorAvailabilityCreateRequest;
import com.clinic.dto.response.DoctorAvailabilityResponse;
import com.clinic.entity.DoctorAvailability;
import com.clinic.entity.Doctor;
import com.clinic.entity.Laboratory;
import org.springframework.stereotype.Component;

@Component
public class DoctorAvailabilityMapper {

    public DoctorAvailability toEntity(DoctorAvailabilityCreateRequest request, Doctor doctor, Laboratory laboratory) {
        if (request == null) {
            return null;
        }

        return DoctorAvailability.builder()
                .doctor(doctor)
                .laboratory(laboratory)
                .dayOfWeek(request.dayOfWeek())
                .startTime(request.startTime())
                .endTime(request.endTime())
                .isAvailable(request.isAvailable() != null ? request.isAvailable() : true)
                .maxPatients(request.maxPatients())
                .notes(request.notes())
                .build();
    }

    public DoctorAvailabilityResponse toResponse(DoctorAvailability availability) {
        if (availability == null) {
            return null;
        }

        return new DoctorAvailabilityResponse(
                availability.getId(),
                availability.getDoctor().getId(),
                availability.getDoctor().getFullName(),
                availability.getLaboratory().getId(),
                availability.getLaboratory().getName(),
                availability.getDayOfWeek(),
                availability.getStartTime(),
                availability.getEndTime(),
                availability.getIsAvailable(),
                availability.getMaxPatients(),
                availability.getNotes(),
                availability.getCreatedAt(),
                availability.getUpdatedAt()
        );
    }

    public void updateEntity(DoctorAvailability availability, DoctorAvailabilityCreateRequest request) {
        if (availability == null || request == null) {
            return;
        }

        if (request.dayOfWeek() != null) {
            availability.setDayOfWeek(request.dayOfWeek());
        }
        if (request.startTime() != null) {
            availability.setStartTime(request.startTime());
        }
        if (request.endTime() != null) {
            availability.setEndTime(request.endTime());
        }
        if (request.isAvailable() != null) {
            availability.setIsAvailable(request.isAvailable());
        }
        if (request.maxPatients() != null) {
            availability.setMaxPatients(request.maxPatients());
        }
        if (request.notes() != null) {
            availability.setNotes(request.notes());
        }
    }
}
