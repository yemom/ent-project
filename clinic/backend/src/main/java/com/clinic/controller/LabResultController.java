package com.clinic.controller;

import com.clinic.dto.request.CreateLabResultRequest;
import com.clinic.dto.request.UpdateLabResultRequest;
import com.clinic.dto.request.UpdateLabResultStatusRequest;
import com.clinic.dto.response.LabResultResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.entity.LabResultStatus;
import com.clinic.service.LabResultService;
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
@RequestMapping("/api/lab-results")
@Slf4j
public class LabResultController {

    private final LabResultService labResultService;

    public LabResultController(LabResultService labResultService) {
        this.labResultService = labResultService;
    }

    @PostMapping
    @PreAuthorize("hasRole('LABORATORY')")
    public ResponseEntity<LabResultResponse> create(@Valid @RequestBody CreateLabResultRequest request) {
        log.info("Create lab result request received for order={}", request.labOrderId());
        return ResponseEntity.status(HttpStatus.CREATED).body(labResultService.create(request));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('DOCTOR', 'LABORATORY', 'ADMIN')")
    public ResponseEntity<LabResultResponse> getById(@PathVariable String id) {
        return ResponseEntity.ok(labResultService.getById(id));
    }

    @GetMapping("/order/{orderId}")
    @PreAuthorize("hasAnyRole('DOCTOR', 'LABORATORY', 'ADMIN')")
    public ResponseEntity<LabResultResponse> getByLabOrderId(@PathVariable String orderId) {
        return labResultService.getByLabOrderId(orderId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('DOCTOR', 'LABORATORY', 'ADMIN')")
    public ResponseEntity<PageResponse<LabResultResponse>> getAll(
            @RequestParam(required = false) LabResultStatus status,
            @RequestParam(required = false) String labTechnicianId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<LabResultResponse> page;
        if (status != null) {
            page = labResultService.getByStatus(status, pageable);
        } else if (labTechnicianId != null && !labTechnicianId.isBlank()) {
            page = labResultService.getByLabTechnicianId(labTechnicianId, pageable);
        } else {
            page = labResultService.getAll(pageable);
        }
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('LABORATORY')")
    public ResponseEntity<LabResultResponse> update(
            @PathVariable String id,
            @Valid @RequestBody UpdateLabResultRequest request
    ) {
        log.info("Update lab result request id={}", id);
        return ResponseEntity.ok(labResultService.update(id, request));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('LABORATORY')")
    public ResponseEntity<LabResultResponse> updateStatus(
            @PathVariable String id,
            @Valid @RequestBody UpdateLabResultStatusRequest request
    ) {
        log.info("Update lab result status request id={} status={}", id, request.status());
        return ResponseEntity.ok(labResultService.updateStatus(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        labResultService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
