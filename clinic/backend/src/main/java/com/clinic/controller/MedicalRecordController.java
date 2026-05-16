package com.clinic.controller;

import com.clinic.config.ApiPaths;
import com.clinic.dto.request.MedicalRecordSearchRequest;
import com.clinic.dto.request.MedicalRecordUpdateRequest;
import com.clinic.dto.request.MedicalRecordCreateRequest;
import com.clinic.dto.response.MedicalRecordResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.service.MedicalRecordService;
import jakarta.validation.Valid;
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

@RestController
@RequestMapping(ApiPaths.MEDICAL_RECORDS)
public class MedicalRecordController {

    private final MedicalRecordService medicalRecordService;

    public MedicalRecordController(MedicalRecordService medicalRecordService) {
        this.medicalRecordService = medicalRecordService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    public ResponseEntity<MedicalRecordResponse> create(@Valid @RequestBody MedicalRecordCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(medicalRecordService.create(request));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public ResponseEntity<MedicalRecordResponse> getById(@PathVariable String id) {
        return ResponseEntity.ok(medicalRecordService.getById(id));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public ResponseEntity<PageResponse<MedicalRecordResponse>> getAll(
            @PageableDefault(size = 20, sort = "recordDate", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<MedicalRecordResponse> page = medicalRecordService.getAll(pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
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
        MedicalRecordSearchRequest request = new MedicalRecordSearchRequest(
                patientId,
                doctorId,
                appointmentId,
                fromDate,
                toDate,
                confidential,
                keyword
        );
        Page<MedicalRecordResponse> page = medicalRecordService.search(request, pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    public ResponseEntity<MedicalRecordResponse> update(@PathVariable String id, @Valid @RequestBody MedicalRecordUpdateRequest request) {
        return ResponseEntity.ok(medicalRecordService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        medicalRecordService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
