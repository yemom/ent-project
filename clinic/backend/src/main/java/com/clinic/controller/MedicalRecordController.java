package com.clinic.controller;

import com.clinic.config.ApiPaths;
import com.clinic.dto.request.BreakGlassAccessRequest;
import com.clinic.dto.request.MedicalRecordAmendRequest;
import com.clinic.dto.response.MedicalRecordAmendmentResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.MedicalRecordResponse;
import com.clinic.dto.response.MyMedicalRecordResponse;
import com.clinic.security.CurrentUser;
import com.clinic.service.AuditLogService;
import com.clinic.service.BreakGlassService;
import com.clinic.service.MedicalRecordService;
import com.clinic.service.OwnRecordFilter;
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

    /**
     * Who may read clinical records at all.
     *
     * <p>{@code own_record:read} is deliberately excluded here: a patient reading
     * their own chart is served by {@code /me} and by the ownership-checked
     * {@code /{id}}, never by the clinic-wide listings below, which would otherwise
     * become an enumeration surface.
     */
    private static final String CLINICAL_READ =
            "hasAuthority('PERM_diagnosis:write') or hasAuthority('PERM_vital:write')";

    private final MedicalRecordService medicalRecordService;
    private final BreakGlassService breakGlassService;
    private final AuditLogService auditLogService;
    private final CurrentUser currentUser;

    public MedicalRecordController(MedicalRecordService medicalRecordService,
                                   BreakGlassService breakGlassService,
                                   AuditLogService auditLogService,
                                   CurrentUser currentUser) {
        this.medicalRecordService = medicalRecordService;
        this.breakGlassService = breakGlassService;
        this.auditLogService = auditLogService;
        this.currentUser = currentUser;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PERM_diagnosis:write')")
    public ResponseEntity<MedicalRecordResponse> create(@Valid @RequestBody com.clinic.dto.request.MedicalRecordCreateRequest request) {
        MedicalRecordResponse created = medicalRecordService.create(request);
        auditLogService.record(AuditAction.RECORD_CREATED, "MEDICAL_RECORD", created.id(), "Created clinical record");
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/{id}")
    @PreAuthorize(CLINICAL_READ + " or hasAuthority('PERM_own_record:read')")
    public ResponseEntity<MedicalRecordResponse> getById(@PathVariable String id) {
        // Routed through the ownership-aware read so `own_record:read` is only ever
        // able to reach the caller's own record.
        MedicalRecordResponse record = medicalRecordService.getByIdForCaller(id);
        auditLogService.record(AuditAction.RECORD_VIEWED, "MEDICAL_RECORD", id, "Viewed clinical record");
        return ResponseEntity.ok(record);
    }

    /**
     * The signed-in patient's own records.
     *
     * <p>This exists because the clinical listing endpoints require
     * {@code diagnosis:write}, a permission the PATIENT role deliberately does not
     * hold. Granting it would be the wrong fix: it would hand a patient the ability
     * to create, amend and sign any patient's chart. A separate, read-only,
     * ownership-scoped listing grants exactly what a patient needs and nothing more.
     *
     * <p>The patient is derived from the principal in the service, so there is no
     * {@code patientId} parameter to tamper with. Ownership is a predicate the
     * caller cannot switch off, not a filter it can widen.
     *
     * <p>Reads are audited, as with every other clinical read.
     */
    @GetMapping("/me")
    @PreAuthorize("hasAuthority('PERM_own_record:read')")
    public ResponseEntity<PageResponse<MyMedicalRecordResponse>> myRecords(
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 20, sort = "recordDate", direction = Sort.Direction.DESC)
            @ParameterObject Pageable pageable
    ) {
        Page<MyMedicalRecordResponse> page = medicalRecordService.getOwnRecords(
                new OwnRecordFilter(fromDate, toDate, keyword), pageable);
        auditLogService.record(AuditAction.RECORD_VIEWED, "MEDICAL_RECORD", currentUser.userId(),
                "Viewed own medical records (" + page.getTotalElements() + " records)");
        return ResponseEntity.ok(PageResponse.of(page));
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

    /**
     * Clinic-wide record search.
     *
     * <p>Deliberately narrower than the by-id read: `vital:write` may open a record
     * a nurse was given, but must not become clinic-wide enumeration of every
     * patient's chart. Broadening this to match {@code /{id}} would hand nurses a
     * directory they were not granted, so it stays on `diagnosis:write`.
     */
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

    /**
     * Amendment history.
     *
     * <p>Also reachable by {@code own_record:read}: a patient is entitled to the
     * record of every change made to their chart. The ownership check runs first, so
     * the amendment list cannot be used to discover another patient's record ids.
     */
    @GetMapping("/{id}/amendments")
    @PreAuthorize(CLINICAL_READ + " or hasAuthority('PERM_own_record:read')")
    public ResponseEntity<List<MedicalRecordAmendmentResponse>> amendments(@PathVariable String id) {
        medicalRecordService.getByIdForCaller(id);
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