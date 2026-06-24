package com.clinic.service.impl;

import com.clinic.dto.request.CreateLabOrderRequest;
import com.clinic.dto.request.UpdateLabOrderStatusRequest;
import com.clinic.dto.response.LabOrderResponse;
import com.clinic.entity.LabOrder;
import com.clinic.entity.LabOrderStatus;
import com.clinic.entity.User;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.LabOrderMapper;
import com.clinic.repository.LabOrderRepository;
import com.clinic.repository.UserRepository;
import com.clinic.service.LabOrderService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static com.clinic.config.CacheNames.LAB_ORDERS;

@Service
@Transactional
@Slf4j
public class LabOrderServiceImpl implements LabOrderService {

    private final LabOrderRepository labOrderRepository;
    private final UserRepository userRepository;
    private final LabOrderMapper mapper;

    public LabOrderServiceImpl(LabOrderRepository labOrderRepository, UserRepository userRepository, LabOrderMapper mapper) {
        this.labOrderRepository = labOrderRepository;
        this.userRepository = userRepository;
        this.mapper = mapper;
    }

    @Override
    @CacheEvict(cacheNames = LAB_ORDERS, allEntries = true)
    public LabOrderResponse create(CreateLabOrderRequest request) {
        LabOrder order = mapper.toEntity(request);
        LabOrder saved = labOrderRepository.save(order);
        log.info("Created lab order id={}", saved.getId());
        return mapper.toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = LAB_ORDERS, key = "'id:' + #id")
    public LabOrderResponse getById(String id) {
        return mapper.toResponse(getEntityById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LabOrderResponse> getAll(Pageable pageable) {
        return mapPage(labOrderRepository.findAll(pageable));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LabOrderResponse> getByStatus(LabOrderStatus status, Pageable pageable) {
        return mapPage(labOrderRepository.findByStatus(status, pageable));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LabOrderResponse> getByDoctorId(String doctorId, Pageable pageable) {
        return mapPage(labOrderRepository.findByDoctorId(doctorId, pageable));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LabOrderResponse> getByPatientId(String patientId, Pageable pageable) {
        return mapPage(labOrderRepository.findByPatientId(patientId, pageable));
    }

    @Override
    @CacheEvict(cacheNames = LAB_ORDERS, allEntries = true)
    public LabOrderResponse updateStatus(String id, UpdateLabOrderStatusRequest request) {
        LabOrder order = getEntityById(id);
        order.setStatus(LabOrderStatus.valueOf(request.status().toUpperCase()));
        LabOrder updated = labOrderRepository.save(order);
        log.info("Updated lab order status id={} status={}", id, request.status());
        return mapper.toResponse(updated);
    }

    @Override
    @CacheEvict(cacheNames = LAB_ORDERS, allEntries = true)
    public void delete(String id) {
        labOrderRepository.deleteById(id);
        log.info("Deleted lab order id={}", id);
    }

    private LabOrder getEntityById(String id) {
        return labOrderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lab order not found with id: " + id));
    }

    private Page<LabOrderResponse> mapPage(Page<LabOrder> page) {
        Map<String, String> userNamesById = loadUserNames(page);
        return page.map(order -> mapper.toResponse(order, userNamesById));
    }

    private Map<String, String> loadUserNames(Page<LabOrder> page) {
        Set<String> userIds = page.getContent().stream()
                .flatMap(order -> java.util.stream.Stream.of(order.getPatientId(), order.getDoctorId()))
                .collect(Collectors.toSet());

        return userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, User::getFullName, (left, right) -> left));
    }
}
