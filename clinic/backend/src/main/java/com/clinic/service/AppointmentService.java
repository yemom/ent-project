package com.clinic.service;

import com.clinic.dto.request.AppointmentCreateRequest;
import com.clinic.dto.request.AppointmentSearchRequest;
import com.clinic.dto.request.AppointmentStatusRequest;
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

    /**
     * Moves an appointment to another lifecycle state.
     *
     * <p>Transitions are validated against {@link com.clinic.entity.AppointmentStatus};
     * a request that skips a step is rejected rather than silently applied.
     */
    AppointmentResponse changeStatus(String id, AppointmentStatusRequest request);

    void delete(String id);
}