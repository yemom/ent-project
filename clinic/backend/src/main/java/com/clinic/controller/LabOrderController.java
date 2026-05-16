package com.clinic.controller;

import com.clinic.dto.request.CreateLabOrderRequest;
import com.clinic.dto.request.UpdateLabOrderStatusRequest;
import com.clinic.dto.response.LabOrderResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.entity.LabOrderStatus;
import com.clinic.service.LabOrderService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/lab-orders")
@Slf4j
public class LabOrderController {

    private final LabOrderService labOrderService;

    public LabOrderController(LabOrderService labOrderService) {
        this.labOrderService = labOrderService;
    }

    @PostMapping
    @PreAuthorize("hasRole('DOCTOR')")
    public ResponseEntity<LabOrderResponse> create(@Valid @RequestBody CreateLabOrderRequest request) {
        log.info("Create lab order request received for doctor={}", request.doctorId());
        return ResponseEntity.status(HttpStatus.CREATED).body(labOrderService.create(request));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('DOCTOR', 'LABORATORY', 'ADMIN')")
    public ResponseEntity<LabOrderResponse> getById(@PathVariable String id) {
        return ResponseEntity.ok(labOrderService.getById(id));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('DOCTOR', 'LABORATORY', 'ADMIN')")
    public ResponseEntity<PageResponse<LabOrderResponse>> getAll(
            @RequestParam(required = false) String doctorId,
            @RequestParam(required = false) String patientId,
            @RequestParam(required = false) LabOrderStatus status,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<LabOrderResponse> page;
        if (doctorId != null && !doctorId.isBlank()) {
            page = labOrderService.getByDoctorId(doctorId, pageable);
        } else if (patientId != null && !patientId.isBlank()) {
            page = labOrderService.getByPatientId(patientId, pageable);
        } else if (status != null) {
            page = labOrderService.getByStatus(status, pageable);
        } else {
            page = labOrderService.getAll(pageable);
        }
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('LABORATORY')")
    public ResponseEntity<LabOrderResponse> updateStatus(
            @PathVariable String id,
            @Valid @RequestBody UpdateLabOrderStatusRequest request
    ) {
        log.info("Update lab order status request id={} status={}", id, request.status());
        return ResponseEntity.ok(labOrderService.updateStatus(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        labOrderService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
