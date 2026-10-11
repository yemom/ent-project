package com.clinic.controller;

import com.clinic.config.ApiPaths;
import com.clinic.dto.request.BreakGlassAccessRequest;
import com.clinic.dto.request.MedicalRecordAmendRequest;
import com.clinic.dto.response.MedicalRecordAmendmentResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.MedicalRecordResponse;
import com.clinic.service.AuditLogService;
import com.clinic.service.BreakGlassService;
import com.clinic.service.MedicalRecordService;
import com.clinic.entity.AuditAction;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

/**
 * Clinical records.
 *
 * <p>Only roles holding {@code diagnosis:write} can create or amend a record;
 * nurses and pharmacists get read-only access. Reads are audited, and a signed
 * record is never silently overwritten — it is amended with history.
 */
@RestController
@RequestMapping(ApiPaths.MEDICAL_RECORDS)
@Slf4j
public class MedicalRecordController {

    private final MedicalRecordService medicalRecordService;
    private final BreakGlassService breakGlassService;
    private final AuditLogService auditLogService;

    public MedicalRecordController(MedicalRecordService medicalRecordService,
                                   BreakGlassService breakGlassService,
                                   AuditLogService auditLogService) {
        this.medicalRecordService = medicalRecordService;
        this.breakGlassService = breakGlassService;
        this.auditLogService = auditLogService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PERM_diagnosis:write')")
    public ResponseEntity<MedicalRecordResponse> create(@Valid @RequestBody com.clinic.dto.request.MedicalRecordCreateRequest request) {
        MedicalRecordResponse created = medicalRecordService.create(request);
        auditLogService.record(AuditAction.RECORD_CREATED, "MEDICAL_RECORD", created.id(), "Created clinical record");
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_diagnosis:write') or hasAuthority('PERM_vital:write')")
    public ResponseEntity<MedicalRecordResponse> getById(@PathVariable String id) {
        MedicalRecordResponse record = medicalRecordService.getById(id);
        auditLogService.record(AuditAction.RECORD_VIEWED, "MEDICAL_RECORD", id, "Viewed clinical record");
        return ResponseEntity.ok(record);
    }

    /**
     * Emergency access. Requires an explicit reason, is fully audited, and is the
     * only way to read a record outside your assigned panel.
     */
    @GetMapping("/{id}/break-glass")
    @PreAuthorize("hasAuthority('PERM_patient:demographics:read')")
    public ResponseEntity<MedicalRecordResponse> breakGlass(
            @PathVariable String id,
            @Valid @RequestBody BreakGlassAccessRequest request) {
        log.warn("Break-glass access to medical record {} by {}", id, "clinical staff");
        breakGlassService.recordAccess(id, request.reason());
        return ResponseEntity.ok(medicalRecordService.getById(id));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PERM_diagnosis:write')")
    public ResponseEntity<PageResponse<MedicalRecordResponse>> getAll(
            @PageableDefault(size = 20, sort = "recordDate", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<MedicalRecordResponse> page = medicalRecordService.getAll(pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @GetMapping("/search")
    @PreAuthorize("hasAuthority('PERM_diagnosis:write')")
    public ResponseEntity<PageResponse<MedicalRecordResponse>> search(
            @RequestParam(required = false) String patientId,
            @RequestParam(required = false) String doctorId,
            @RequestParam(required = false) String appointmentId,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            @RequestParam(required = false) Boolean confidential,
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 20, sort = "recordDate", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        var request = new com.clinic.dto.request.MedicalRecordSearchRequest(
                patientId, doctorId, appointmentId, fromDate, toDate, confidential, keyword);
        Page<MedicalRecordResponse> page = medicalRecordService.search(request, pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    /**
     * Amends a record. A mandatory reason is required and the previous values are
     * stored as an immutable amendment row.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_diagnosis:write')")
    public ResponseEntity<MedicalRecordResponse> update(@PathVariable String id,
                                                        @Valid @RequestBody MedicalRecordAmendRequest request) {
        MedicalRecordResponse updated = medicalRecordService.amend(id, request);
        auditLogService.record(AuditAction.RECORD_AMENDED, "MEDICAL_RECORD", id,
                "Amended clinical record: " + request.reason());
        return ResponseEntity.ok(updated);
    }

    @GetMapping("/{id}/amendments")
    @PreAuthorize("hasAuthority('PERM_diagnosis:write')")
    public ResponseEntity<List<MedicalRecordAmendmentResponse>> amendments(@PathVariable String id) {
        return ResponseEntity.ok(medicalRecordService.amendmentHistory(id));
    }

    @PostMapping("/{id}/sign")
    @PreAuthorize("hasAuthority('PERM_diagnosis:write')")
    public ResponseEntity<MedicalRecordResponse> sign(@PathVariable String id) {
        return ResponseEntity.ok(medicalRecordService.sign(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_diagnosis:write')")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        medicalRecordService.delete(id);
        return ResponseEntity.noContent().build();
    }
}