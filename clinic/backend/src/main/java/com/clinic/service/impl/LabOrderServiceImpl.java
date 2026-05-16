package com.clinic.service.impl;

import com.clinic.dto.request.CreateLabOrderRequest;
import com.clinic.dto.request.UpdateLabOrderStatusRequest;
import com.clinic.dto.response.LabOrderResponse;
import com.clinic.entity.LabOrder;
import com.clinic.entity.LabOrderStatus;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.LabOrderMapper;
import com.clinic.repository.LabOrderRepository;
import com.clinic.service.LabOrderService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@Slf4j
public class LabOrderServiceImpl implements LabOrderService {

    private final LabOrderRepository labOrderRepository;
    private final LabOrderMapper mapper;

    public LabOrderServiceImpl(LabOrderRepository labOrderRepository, LabOrderMapper mapper) {
        this.labOrderRepository = labOrderRepository;
        this.mapper = mapper;
    }

    @Override
    public LabOrderResponse create(CreateLabOrderRequest request) {
        LabOrder order = mapper.toEntity(request);
        LabOrder saved = labOrderRepository.save(order);
        log.info("Created lab order id={}", saved.getId());
        return mapper.toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public LabOrderResponse getById(String id) {
        return mapper.toResponse(getEntityById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LabOrderResponse> getAll(Pageable pageable) {
        return labOrderRepository.findAll(pageable).map(mapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LabOrderResponse> getByStatus(LabOrderStatus status, Pageable pageable) {
        return labOrderRepository.findByStatus(status, pageable).map(mapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LabOrderResponse> getByDoctorId(String doctorId, Pageable pageable) {
        return labOrderRepository.findByDoctorId(doctorId, pageable).map(mapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LabOrderResponse> getByPatientId(String patientId, Pageable pageable) {
        return labOrderRepository.findByPatientId(patientId, pageable).map(mapper::toResponse);
    }

    @Override
    public LabOrderResponse updateStatus(String id, UpdateLabOrderStatusRequest request) {
        LabOrder order = getEntityById(id);
        order.setStatus(LabOrderStatus.valueOf(request.status().toUpperCase()));
        LabOrder updated = labOrderRepository.save(order);
        log.info("Updated lab order status id={} status={}", id, request.status());
        return mapper.toResponse(updated);
    }

    @Override
    public void delete(String id) {
        labOrderRepository.deleteById(id);
        log.info("Deleted lab order id={}", id);
    }

    private LabOrder getEntityById(String id) {
        return labOrderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lab order not found with id: " + id));
    }
}
