package com.clinic.service;

import com.clinic.dto.request.DoctorCreateRequest;
import com.clinic.dto.request.DoctorUpdateRequest;
import com.clinic.dto.response.DoctorResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface DoctorService {

    DoctorResponse create(DoctorCreateRequest request);

    DoctorResponse update(UUID id, DoctorUpdateRequest request);

    DoctorResponse getById(UUID id);

    Page<DoctorResponse> getAll(Pageable pageable);

    Page<DoctorResponse> search(String fullName, String email, String specialization, Boolean active, Boolean available, Pageable pageable);

    void delete(UUID id);
}
