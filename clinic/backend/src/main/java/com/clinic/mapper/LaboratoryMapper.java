package com.clinic.mapper;

import com.clinic.dto.request.LaboratoryCreateRequest;
import com.clinic.dto.response.LaboratoryResponse;
import com.clinic.entity.Laboratory;
import org.springframework.stereotype.Component;

@Component
public class LaboratoryMapper {

    public Laboratory toEntity(LaboratoryCreateRequest request) {
        if (request == null) {
            return null;
        }

        return Laboratory.builder()
                .name(request.name())
                .location(request.location())
                .phone(request.phone())
                .email(request.email())
                .status(request.status() != null ? request.status() : "ACTIVE")
                .operatingHoursStart(request.operatingHoursStart())
                .operatingHoursEnd(request.operatingHoursEnd())
                .equipment(request.equipment())
                .capacity(request.capacity())
                .description(request.description())
                .build();
    }

    public LaboratoryResponse toResponse(Laboratory laboratory) {
        if (laboratory == null) {
            return null;
        }

        return new LaboratoryResponse(
                laboratory.getId(),
                laboratory.getName(),
                laboratory.getLocation(),
                laboratory.getPhone(),
                laboratory.getEmail(),
                laboratory.getStatus(),
                laboratory.getOperatingHoursStart(),
                laboratory.getOperatingHoursEnd(),
                laboratory.getEquipment(),
                laboratory.getCapacity(),
                laboratory.getDescription(),
                laboratory.getCreatedAt(),
                laboratory.getUpdatedAt()
        );
    }

    public void updateEntity(Laboratory laboratory, LaboratoryCreateRequest request) {
        if (laboratory == null || request == null) {
            return;
        }

        if (request.name() != null) {
            laboratory.setName(request.name());
        }
        if (request.location() != null) {
            laboratory.setLocation(request.location());
        }
        if (request.phone() != null) {
            laboratory.setPhone(request.phone());
        }
        if (request.email() != null) {
            laboratory.setEmail(request.email());
        }
        if (request.status() != null) {
            laboratory.setStatus(request.status());
        }
        if (request.operatingHoursStart() != null) {
            laboratory.setOperatingHoursStart(request.operatingHoursStart());
        }
        if (request.operatingHoursEnd() != null) {
            laboratory.setOperatingHoursEnd(request.operatingHoursEnd());
        }
        if (request.equipment() != null) {
            laboratory.setEquipment(request.equipment());
        }
        if (request.capacity() != null) {
            laboratory.setCapacity(request.capacity());
        }
        if (request.description() != null) {
            laboratory.setDescription(request.description());
        }
    }
}
