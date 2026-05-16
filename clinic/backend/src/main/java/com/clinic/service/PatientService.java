package com.clinic.service;

import com.clinic.dto.request.PatientCreateRequest;
import com.clinic.dto.request.PatientUpdateRequest;
import com.clinic.dto.response.PatientResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface PatientService {

    PatientResponse create(PatientCreateRequest request);

    PatientResponse update(String id, PatientUpdateRequest request);

    PatientResponse getById(String id);

    Page<PatientResponse> getAll(Pageable pageable);

    Page<PatientResponse> search(String fullName, String email, String phone, Boolean active, Pageable pageable);

    void delete(String id);
}
