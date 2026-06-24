package com.clinic.service;

import com.clinic.dto.request.DoctorAvailabilityCreateRequest;
import com.clinic.dto.response.DoctorAvailabilityResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface DoctorAvailabilityService {

    DoctorAvailabilityResponse create(DoctorAvailabilityCreateRequest request);

    DoctorAvailabilityResponse update(String id, DoctorAvailabilityCreateRequest request);

    DoctorAvailabilityResponse getById(String id);

    Page<DoctorAvailabilityResponse> getAll(Pageable pageable);

    Page<DoctorAvailabilityResponse> getByDoctorId(String doctorId, Pageable pageable);

    Page<DoctorAvailabilityResponse> getByLaboratoryId(String laboratoryId, Pageable pageable);

    Page<DoctorAvailabilityResponse> getByDayOfWeek(String dayOfWeek, Pageable pageable);

    void delete(String id);
}
