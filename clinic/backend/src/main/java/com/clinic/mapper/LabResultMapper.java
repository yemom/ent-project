package com.clinic.mapper;

import com.clinic.dto.request.CreateLabResultRequest;
import com.clinic.dto.response.LabResultResponse;
import com.clinic.entity.LabResult;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.UUID;

@Component
public class LabResultMapper {

    private final LabOrderMapper labOrderMapper;

    public LabResultMapper(LabOrderMapper labOrderMapper) {
        this.labOrderMapper = labOrderMapper;
    }

    public LabResult toEntity(CreateLabResultRequest request) {
        return LabResult.builder()
                .id(UUID.randomUUID().toString())
                .labTechnicianId(request.labTechnicianId())
                .findings(request.findings())
                .fileUrl(request.fileUrl())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
    }

    public LabResultResponse toResponse(LabResult entity) {
        return new LabResultResponse(
                entity.getId(),
                labOrderMapper.toResponse(entity.getLabOrder()),
                entity.getLabTechnicianId(),
                entity.getFindings(),
                entity.getFileUrl(),
                entity.getStatus(),
                entity.getSubmittedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}
