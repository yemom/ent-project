package com.clinic.service;

import com.clinic.dto.request.AppointmentCreateRequest;
import com.clinic.dto.request.AppointmentSearchRequest;
import com.clinic.dto.request.AppointmentUpdateRequest;
import com.clinic.dto.response.AppointmentResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
public interface AppointmentService {

    AppointmentResponse create(AppointmentCreateRequest request);

    AppointmentResponse update(String id, AppointmentUpdateRequest request);

    AppointmentResponse getById(String id);

    Page<AppointmentResponse> getAll(Pageable pageable);

    Page<AppointmentResponse> search(AppointmentSearchRequest request, Pageable pageable);

    AppointmentResponse cancel(String id, String cancellationReason);

    void delete(String id);
}
