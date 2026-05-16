package com.clinic.service;

import com.clinic.dto.request.MedicalRecordCreateRequest;
import com.clinic.dto.request.MedicalRecordSearchRequest;
import com.clinic.dto.request.MedicalRecordUpdateRequest;
import com.clinic.dto.response.MedicalRecordResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface MedicalRecordService {

    MedicalRecordResponse create(MedicalRecordCreateRequest request);

    MedicalRecordResponse update(String id, MedicalRecordUpdateRequest request);

    MedicalRecordResponse getById(String id);

    Page<MedicalRecordResponse> getAll(Pageable pageable);

    Page<MedicalRecordResponse> search(MedicalRecordSearchRequest request, Pageable pageable);

    void delete(String id);
}
