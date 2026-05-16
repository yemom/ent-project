package com.clinic.service;

import com.clinic.dto.request.CreateLabOrderRequest;
import com.clinic.dto.request.UpdateLabOrderStatusRequest;
import com.clinic.dto.response.LabOrderResponse;
import com.clinic.entity.LabOrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface LabOrderService {

    LabOrderResponse create(CreateLabOrderRequest request);

    LabOrderResponse getById(String id);

    Page<LabOrderResponse> getAll(Pageable pageable);

    Page<LabOrderResponse> getByStatus(LabOrderStatus status, Pageable pageable);

    Page<LabOrderResponse> getByDoctorId(String doctorId, Pageable pageable);

    Page<LabOrderResponse> getByPatientId(String patientId, Pageable pageable);

    LabOrderResponse updateStatus(String id, UpdateLabOrderStatusRequest request);

    void delete(String id);
}
