package com.clinic.service.impl;

import com.clinic.dto.request.CreateLabResultRequest;
import com.clinic.dto.request.UpdateLabResultRequest;
import com.clinic.dto.request.UpdateLabResultStatusRequest;
import com.clinic.dto.response.LabResultResponse;
import com.clinic.entity.LabOrder;
import com.clinic.entity.LabResult;
import com.clinic.entity.LabResultStatus;
import com.clinic.entity.NotificationType;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.LabResultMapper;
import com.clinic.repository.LabOrderRepository;
import com.clinic.repository.LabResultRepository;
import com.clinic.service.LabResultService;
import com.clinic.service.NotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Set;

import static com.clinic.config.CacheNames.LAB_RESULTS;

@Service
@Transactional
@Slf4j
public class LabResultServiceImpl implements LabResultService {

    private final LabResultRepository labResultRepository;
    private final LabOrderRepository labOrderRepository;
    private final NotificationService notificationService;
    private final LabResultMapper mapper;

    public LabResultServiceImpl(LabResultRepository labResultRepository,
                                LabOrderRepository labOrderRepository,
                                NotificationService notificationService,
                                LabResultMapper mapper) {
        this.labResultRepository = labResultRepository;
        this.labOrderRepository = labOrderRepository;
        this.notificationService = notificationService;
        this.mapper = mapper;
    }

    @Override
    @CacheEvict(cacheNames = LAB_RESULTS, allEntries = true)
    public LabResultResponse create(CreateLabResultRequest request) {
        LabOrder labOrder = labOrderRepository.findById(request.labOrderId())
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
                .critical(Boolean.TRUE.equals(request.critical()))
                .submittedAt(status == LabResultStatus.FINAL ? now : null)
                .createdAt(now)
                .build();

        LabResult saved = labResultRepository.save(result);
        log.info("Created lab result id={} critical={}", saved.getId(), saved.getCritical());
        notifyOrderingDoctorIfFinal(saved);
        notifyDoctorIfCritical(saved);
        return mapper.toResponse(saved);
    }

    /**
     * A critical result notifies the ordering doctor immediately, not only on
     * finalisation.
     *
     * <p>Waiting for the result to be marked final would delay the alert for
     * exactly the findings that must not wait, so a critical draft notifies too.
     */
    private void notifyDoctorIfCritical(LabResult result) {
        if (!Boolean.TRUE.equals(result.getCritical()) || result.getLabOrder() == null) {
            return;
        }

        String doctorId = result.getLabOrder().getDoctorId();
        if (doctorId == null || doctorId.isBlank()) {
            return;
        }

        notificationService.createForUser(
                doctorId,
                com.clinic.entity.NotificationType.LAB_RESULT_READY,
                "Critical laboratory result",
                String.format("A critical result was recorded for order %s.",
                        result.getLabOrder().getId()),
                result.getLabOrder().getId(),
                "/doctor/laboratory");
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

    /** A validated result goes back to the doctor who ordered the investigation. */
    private void notifyOrderingDoctorIfFinal(LabResult result) {
        if (!LabResultStatus.FINAL.equals(result.getStatus()) || result.getLabOrder() == null) {
            return;
        }

        String doctorId = result.getLabOrder().getDoctorId();
        if (doctorId == null || doctorId.isBlank()) {
            return;
        }

        notificationService.createForUser(
                doctorId,
                NotificationType.LAB_RESULT_READY,
                "Lab result ready",
                String.format("Lab result %s for order %s is ready for review.",
                        result.getId(), result.getLabOrder().getId()),
                result.getId(),
                "/doctor/laboratory?orderId=" + result.getLabOrder().getId());
    }
}