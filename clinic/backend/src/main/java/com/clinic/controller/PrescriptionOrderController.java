package com.clinic.controller;

import com.clinic.config.ApiPaths;
import com.clinic.dto.request.CreatePrescriptionOrderRequest;
import com.clinic.dto.request.UpdatePrescriptionOrderRequest;
import com.clinic.dto.request.UpdatePrescriptionOrderStatusRequest;
import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.PrescriptionOrderResponse;
import com.clinic.entity.PrescriptionOrderStatus;
import com.clinic.service.PrescriptionOrderService;
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
@RequestMapping(ApiPaths.PRESCRIPTION_ORDERS)
@Slf4j
public class PrescriptionOrderController {

    private final PrescriptionOrderService prescriptionOrderService;

    public PrescriptionOrderController(PrescriptionOrderService prescriptionOrderService) {
        this.prescriptionOrderService = prescriptionOrderService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PERM_prescription:write')")
    public ResponseEntity<PrescriptionOrderResponse> create(@Valid @RequestBody CreatePrescriptionOrderRequest request) {
        log.info("Create prescription order request received for doctor={}", request.doctorId());
        return ResponseEntity.status(HttpStatus.CREATED).body(prescriptionOrderService.create(request));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_prescription:verify') or hasAuthority('PERM_prescription:write') or hasAuthority('PERM_report:read')")
    public ResponseEntity<PrescriptionOrderResponse> getById(@PathVariable String id) {
        return ResponseEntity.ok(prescriptionOrderService.getById(id));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_prescription:verify') or hasAuthority('PERM_prescription:write') or hasAuthority('PERM_report:read')")
    public ResponseEntity<PageResponse<PrescriptionOrderResponse>> getAll(
            @PageableDefault(size = 20, sort = "orderedAt", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<PrescriptionOrderResponse> page = prescriptionOrderService.getAll(pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @GetMapping("/filter/by-status")
    @PreAuthorize("hasAuthority('PERM_prescription:verify') or hasAuthority('PERM_prescription:write') or hasAuthority('PERM_report:read')")
    public ResponseEntity<PageResponse<PrescriptionOrderResponse>> getByStatus(
            @RequestParam PrescriptionOrderStatus status,
            @PageableDefault(size = 20, sort = "orderedAt", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<PrescriptionOrderResponse> page = prescriptionOrderService.getByStatus(status, pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @GetMapping("/filter/by-doctor/{doctorId}")
    @PreAuthorize("hasAuthority('PERM_prescription:verify') or hasAuthority('PERM_prescription:write') or hasAuthority('PERM_report:read')")
    public ResponseEntity<PageResponse<PrescriptionOrderResponse>> getByDoctorId(
            @PathVariable String doctorId,
            @PageableDefault(size = 20, sort = "orderedAt", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<PrescriptionOrderResponse> page = prescriptionOrderService.getByDoctorId(doctorId, pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAuthority('PERM_prescription:dispense')")
    public ResponseEntity<PrescriptionOrderResponse> updateStatus(
            @PathVariable String id,
            @Valid @RequestBody UpdatePrescriptionOrderStatusRequest request
    ) {
        log.info("Update prescription order status request for id={} status={}", id, request.status());
        return ResponseEntity.ok(prescriptionOrderService.updateStatus(id, request));
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_prescription:write')")
    public ResponseEntity<PrescriptionOrderResponse> update(
            @PathVariable String id,
            @Valid @RequestBody UpdatePrescriptionOrderRequest request
    ) {
        log.info("Update prescription order request for id={}", id);
        return ResponseEntity.ok(prescriptionOrderService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_prescription:write')")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        prescriptionOrderService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
