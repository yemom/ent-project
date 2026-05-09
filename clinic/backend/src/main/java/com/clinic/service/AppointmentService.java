package com.clinic.service;

import com.clinic.dto.request.AppointmentCreateRequest;
import com.clinic.dto.request.AppointmentSearchRequest;
import com.clinic.dto.request.AppointmentUpdateRequest;
import com.clinic.dto.response.AppointmentResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.UUID;

public interface AppointmentService {

    AppointmentResponse create(AppointmentCreateRequest request);

    AppointmentResponse update(UUID id, AppointmentUpdateRequest request);

    AppointmentResponse getById(UUID id);

    Page<AppointmentResponse> getAll(Pageable pageable);

    Page<AppointmentResponse> search(AppointmentSearchRequest request, Pageable pageable);

    AppointmentResponse cancel(UUID id, String cancellationReason);

    void delete(UUID id);
}
