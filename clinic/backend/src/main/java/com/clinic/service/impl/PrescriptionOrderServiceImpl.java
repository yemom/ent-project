package com.clinic.service.impl;

import com.clinic.dto.request.CreatePrescriptionOrderRequest;
import com.clinic.dto.request.UpdatePrescriptionOrderRequest;
import com.clinic.dto.request.UpdatePrescriptionOrderStatusRequest;
import com.clinic.dto.response.PrescriptionOrderResponse;
import com.clinic.entity.PrescriptionOrder;
import com.clinic.entity.PrescriptionOrderStatus;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.PrescriptionOrderMapper;
import com.clinic.repository.PrescriptionOrderRepository;
import com.clinic.service.PrescriptionOrderService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@Transactional
@Slf4j
public class PrescriptionOrderServiceImpl implements PrescriptionOrderService {

    private final PrescriptionOrderRepository prescriptionOrderRepository;
    private final PrescriptionOrderMapper mapper;

    public PrescriptionOrderServiceImpl(
            PrescriptionOrderRepository prescriptionOrderRepository,
            PrescriptionOrderMapper mapper
    ) {
        this.prescriptionOrderRepository = prescriptionOrderRepository;
        this.mapper = mapper;
    }

    @Override
    public PrescriptionOrderResponse create(CreatePrescriptionOrderRequest request) {
        PrescriptionOrder order = mapper.toEntity(request);
        PrescriptionOrder saved = prescriptionOrderRepository.save(order);
        log.info("Created prescription order id={}", saved.getId());
        return mapper.toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public PrescriptionOrderResponse getById(String id) {
        return mapper.toResponse(getEntityById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PrescriptionOrderResponse> getAll(Pageable pageable) {
        return prescriptionOrderRepository.findAll(pageable).map(mapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PrescriptionOrderResponse> getByStatus(PrescriptionOrderStatus status, Pageable pageable) {
        return prescriptionOrderRepository.findByStatus(status, pageable).map(mapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PrescriptionOrderResponse> getByDoctorId(String doctorId, Pageable pageable) {
        return prescriptionOrderRepository.findByDoctorId(doctorId, pageable).map(mapper::toResponse);
    }

    @Override
    public PrescriptionOrderResponse update(String id, UpdatePrescriptionOrderRequest request) {
        PrescriptionOrder order = getEntityById(id);

        if (request.patientName() != null) {
            if (request.patientName().isBlank()) {
                throw new IllegalArgumentException("Patient name must not be blank");
            }
            order.setPatientName(request.patientName().trim());
        }

        if (request.drugName() != null) {
            if (request.drugName().isBlank()) {
                throw new IllegalArgumentException("Drug name must not be blank");
            }
            order.setDrugName(request.drugName().trim());
        }

        if (request.dosage() != null) {
            if (request.dosage().isBlank()) {
                throw new IllegalArgumentException("Dosage must not be blank");
            }
            order.setDosage(request.dosage().trim());
        }

        if (request.instructions() != null) {
            order.setInstructions(request.instructions().trim());
        }

        PrescriptionOrder updated = prescriptionOrderRepository.save(order);
        log.info("Updated prescription order id={}", id);
        return mapper.toResponse(updated);
    }

    @Override
    public PrescriptionOrderResponse updateStatus(String id, UpdatePrescriptionOrderStatusRequest request) {
        PrescriptionOrder order = getEntityById(id);
        order.setStatus(request.status());
        if (request.status() == PrescriptionOrderStatus.DISPENSED) {
            order.setDispensedAt(LocalDateTime.now());
        }
        PrescriptionOrder updated = prescriptionOrderRepository.save(order);
        log.info("Updated prescription order id={} status to {}", id, request.status());
        return mapper.toResponse(updated);
    }

    @Override
    public void delete(String id) {
        PrescriptionOrder order = getEntityById(id);
        prescriptionOrderRepository.delete(order);
        log.info("Deleted prescription order id={}", id);
    }

    private PrescriptionOrder getEntityById(String id) {
        return prescriptionOrderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Prescription order not found with id=" + id));
    }
}
