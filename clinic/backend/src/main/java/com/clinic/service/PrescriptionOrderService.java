package com.clinic.service;

import com.clinic.dto.request.CreatePrescriptionOrderRequest;
import com.clinic.dto.request.UpdatePrescriptionOrderRequest;
import com.clinic.dto.request.UpdatePrescriptionOrderStatusRequest;
import com.clinic.dto.response.PrescriptionOrderResponse;
import com.clinic.entity.PrescriptionOrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface PrescriptionOrderService {

    PrescriptionOrderResponse create(CreatePrescriptionOrderRequest request);

    PrescriptionOrderResponse getById(UUID id);

    Page<PrescriptionOrderResponse> getAll(Pageable pageable);

    Page<PrescriptionOrderResponse> getByStatus(PrescriptionOrderStatus status, Pageable pageable);

    Page<PrescriptionOrderResponse> getByDoctorId(UUID doctorId, Pageable pageable);

    PrescriptionOrderResponse update(UUID id, UpdatePrescriptionOrderRequest request);

    PrescriptionOrderResponse updateStatus(UUID id, UpdatePrescriptionOrderStatusRequest request);

    void delete(UUID id);
}
