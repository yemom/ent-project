package com.clinic.service;

import com.clinic.dto.request.DoctorAvailabilityCreateRequest;
import com.clinic.dto.response.DoctorAvailabilityResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface DoctorAvailabilityService {

    DoctorAvailabilityResponse create(DoctorAvailabilityCreateRequest request);

    DoctorAvailabilityResponse update(String id, DoctorAvailabilityCreateRequest request);

    DoctorAvailabilityResponse getById(String id);

    Page<DoctorAvailabilityResponse> getAll(Pageable pageable);

    List<DoctorAvailabilityResponse> getByDoctorId(String doctorId);

    List<DoctorAvailabilityResponse> getByLaboratoryId(String laboratoryId);

    List<DoctorAvailabilityResponse> getByDayOfWeek(String dayOfWeek);

    void delete(String id);
}
