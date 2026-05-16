package com.clinic.controller;

import com.clinic.config.ApiPaths;
import com.clinic.dto.request.PatientCreateRequest;
import com.clinic.dto.request.PatientUpdateRequest;
import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.PatientResponse;
import com.clinic.service.PatientService;
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

@RestController
@RequestMapping(ApiPaths.PATIENTS)
public class PatientController {

    private final PatientService patientService;

    public PatientController(PatientService patientService) {
        this.patientService = patientService;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PatientResponse> create(@Valid @RequestBody PatientCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(patientService.create(request));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public ResponseEntity<PatientResponse> getById(@PathVariable String id) {
        return ResponseEntity.ok(patientService.getById(id));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    public ResponseEntity<PageResponse<PatientResponse>> getAll(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<PatientResponse> page = patientService.getAll(pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    public ResponseEntity<PageResponse<PatientResponse>> search(
            @RequestParam(required = false) String fullName,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) Boolean active,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<PatientResponse> page = patientService.search(fullName, email, phone, active, pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','PATIENT')")
    public ResponseEntity<PatientResponse> update(@PathVariable String id, @Valid @RequestBody PatientUpdateRequest request) {
        return ResponseEntity.ok(patientService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        patientService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
