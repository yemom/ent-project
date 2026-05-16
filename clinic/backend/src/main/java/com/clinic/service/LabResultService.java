package com.clinic.service;

import com.clinic.dto.request.CreateLabResultRequest;
import com.clinic.dto.request.UpdateLabResultRequest;
import com.clinic.dto.request.UpdateLabResultStatusRequest;
import com.clinic.dto.response.LabResultResponse;
import com.clinic.entity.LabResultStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;

public interface LabResultService {

    LabResultResponse create(CreateLabResultRequest request);

    LabResultResponse getById(String id);

    Optional<LabResultResponse> getByLabOrderId(String labOrderId);

    Page<LabResultResponse> getAll(Pageable pageable);

    Page<LabResultResponse> getByStatus(LabResultStatus status, Pageable pageable);

    Page<LabResultResponse> getByLabTechnicianId(String labTechnicianId, Pageable pageable);

    LabResultResponse update(String id, UpdateLabResultRequest request);

    LabResultResponse updateStatus(String id, UpdateLabResultStatusRequest request);

    void delete(String id);
}
