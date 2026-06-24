package com.clinic.service.impl;

import com.clinic.dto.request.CreateLabResultRequest;
import com.clinic.dto.request.UpdateLabResultRequest;
import com.clinic.dto.request.UpdateLabResultStatusRequest;
import com.clinic.dto.response.LabResultResponse;
import com.clinic.entity.LabResult;
import com.clinic.entity.LabResultStatus;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.LabResultMapper;
import com.clinic.repository.LabResultRepository;
import com.clinic.repository.LabOrderRepository;
import com.clinic.service.AsyncNotificationService;
import com.clinic.service.LabResultService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

import static com.clinic.config.CacheNames.LAB_RESULTS;

@Service
@Transactional
@Slf4j
public class LabResultServiceImpl implements LabResultService {

    private final LabResultRepository labResultRepository;
    private final LabOrderRepository labOrderRepository;
    private final AsyncNotificationService asyncNotificationService;
    private final LabResultMapper mapper;

    public LabResultServiceImpl(LabResultRepository labResultRepository,
                                LabOrderRepository labOrderRepository,
                                AsyncNotificationService asyncNotificationService,
                                LabResultMapper mapper) {
        this.labResultRepository = labResultRepository;
        this.labOrderRepository = labOrderRepository;
        this.asyncNotificationService = asyncNotificationService;
        this.mapper = mapper;
    }

    @Override
    @CacheEvict(cacheNames = LAB_RESULTS, allEntries = true)
    public LabResultResponse create(CreateLabResultRequest request) {
        var labOrder = labOrderRepository.findById(request.labOrderId())
            .orElseThrow(() -> new ResourceNotFoundException("Lab order not found: " + request.labOrderId()));

        LabResultStatus status = request.status() == null || request.status().isBlank()
                ? LabResultStatus.DRAFT
                : LabResultStatus.valueOf(request.status().toUpperCase());
        LocalDateTime now = LocalDateTime.now();

        LabResult result = LabResult.builder()
            .labOrder(labOrder)
            .labTechnicianId(request.labTechnicianId())
            .findings(request.findings())
            .fileUrl(request.fileUrl())
            .status(status)
            .submittedAt(status == LabResultStatus.FINAL ? now : null)
            .createdAt(now)
            .build();

        LabResult saved = labResultRepository.save(result);
        log.info("Created lab result id={}", saved.getId());
        notifyOrderingDoctorIfFinal(saved);
        return mapper.toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = LAB_RESULTS, key = "'id:' + #id")
    public LabResultResponse getById(String id) {
        return mapper.toResponse(getEntityById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<LabResultResponse> getByLabOrderId(String labOrderId) {
        return labResultRepository.findByLabOrderId(labOrderId).map(mapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LabResultResponse> getAll(Pageable pageable) {
        return labResultRepository.findAll(pageable).map(mapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LabResultResponse> getByStatus(LabResultStatus status, Pageable pageable) {
        return labResultRepository.findByStatus(status, pageable).map(mapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LabResultResponse> getByLabTechnicianId(String labTechnicianId, Pageable pageable) {
        return labResultRepository.findByLabTechnicianId(labTechnicianId, pageable).map(mapper::toResponse);
    }

    @Override
    @CacheEvict(cacheNames = LAB_RESULTS, allEntries = true)
    public LabResultResponse update(String id, UpdateLabResultRequest request) {
        LabResult result = getEntityById(id);
        if (request.findings() != null) {
            result.setFindings(request.findings());
        }
        if (request.fileUrl() != null) {
            result.setFileUrl(request.fileUrl());
        }
        result.setUpdatedAt(LocalDateTime.now());
        LabResult updated = labResultRepository.save(result);
        log.info("Updated lab result id={}", id);
        return mapper.toResponse(updated);
    }

    @Override
    @CacheEvict(cacheNames = LAB_RESULTS, allEntries = true)
    public LabResultResponse updateStatus(String id, UpdateLabResultStatusRequest request) {
        LabResult result = getEntityById(id);
        result.setStatus(LabResultStatus.valueOf(request.status().toUpperCase()));
        if (LabResultStatus.FINAL.toString().equals(request.status().toUpperCase())) {
            result.setSubmittedAt(LocalDateTime.now());
        }
        result.setUpdatedAt(LocalDateTime.now());
        LabResult updated = labResultRepository.save(result);
        log.info("Updated lab result status id={} status={}", id, request.status());
        notifyOrderingDoctorIfFinal(updated);
        return mapper.toResponse(updated);
    }

    @Override
    @CacheEvict(cacheNames = LAB_RESULTS, allEntries = true)
    public void delete(String id) {
        labResultRepository.deleteById(id);
        log.info("Deleted lab result id={}", id);
    }

    private LabResult getEntityById(String id) {
        return labResultRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lab result not found with id: " + id));
    }

    private void notifyOrderingDoctorIfFinal(LabResult result) {
        if (!LabResultStatus.FINAL.equals(result.getStatus()) || result.getLabOrder() == null) {
            return;
        }

        String doctorId = result.getLabOrder().getDoctorId();
        asyncNotificationService.notifyLabResultReady(doctorId, result.getLabOrder().getId(), result.getId());
    }
}
