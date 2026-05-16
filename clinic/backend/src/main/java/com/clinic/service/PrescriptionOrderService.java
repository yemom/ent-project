package com.clinic.service;

import com.clinic.dto.request.CreatePrescriptionOrderRequest;
import com.clinic.dto.request.UpdatePrescriptionOrderRequest;
import com.clinic.dto.request.UpdatePrescriptionOrderStatusRequest;
import com.clinic.dto.response.PrescriptionOrderResponse;
import com.clinic.entity.PrescriptionOrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface PrescriptionOrderService {

    PrescriptionOrderResponse create(CreatePrescriptionOrderRequest request);

    PrescriptionOrderResponse getById(String id);

    Page<PrescriptionOrderResponse> getAll(Pageable pageable);

    Page<PrescriptionOrderResponse> getByStatus(PrescriptionOrderStatus status, Pageable pageable);

    Page<PrescriptionOrderResponse> getByDoctorId(String doctorId, Pageable pageable);

    PrescriptionOrderResponse update(String id, UpdatePrescriptionOrderRequest request);

    PrescriptionOrderResponse updateStatus(String id, UpdatePrescriptionOrderStatusRequest request);

    void delete(String id);
}
