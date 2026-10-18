package com.clinic.controller;

import com.clinic.config.ApiPaths;
import com.clinic.dto.request.DoctorCreateRequest;
import com.clinic.dto.request.DoctorUpdateRequest;
import com.clinic.dto.response.DoctorResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.service.DoctorService;
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
@RequestMapping(ApiPaths.DOCTORS)
public class DoctorController {

    /**
     * Roles and permissions that read the doctor directory.
     *
     * <p>The front desk is added below via {@code PERM_patient:assign} — booking a
     * patient in requires choosing a provider — and {@code PERM_staff:manage} opens
     * it to a hospital administrator, whose Staff screen lists the roster. Both read
     * names and specialisations only: no patient data is reachable from here.
     * Writes stay admin-only.
     */
    private static final String READABLE_BY = "hasAnyRole('ADMIN','DOCTOR','PATIENT')";

    /** Granted to the front desk (booking) and to a hospital administrator (roster). */
    private static final String ALSO_READABLE = "or hasAuthority('PERM_patient:assign')"
            + " or hasAuthority('PERM_staff:manage')";

    private final DoctorService doctorService;

    public DoctorController(DoctorService doctorService) {
        this.doctorService = doctorService;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DoctorResponse> create(@Valid @RequestBody DoctorCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(doctorService.create(request));
    }

    @GetMapping("/{id}")
    @PreAuthorize(READABLE_BY + ALSO_READABLE)
    public ResponseEntity<DoctorResponse> getById(@PathVariable String id) {
        return ResponseEntity.ok(doctorService.getById(id));
    }

    @GetMapping
    @PreAuthorize(READABLE_BY + ALSO_READABLE)
    public ResponseEntity<PageResponse<DoctorResponse>> getAll(
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<DoctorResponse> page = doctorService.getAll(pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @GetMapping("/search")
    @PreAuthorize(READABLE_BY + ALSO_READABLE)
    public ResponseEntity<PageResponse<DoctorResponse>> search(
            @RequestParam(required = false) String fullName,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String specialization,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) Boolean available,
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<DoctorResponse> page = doctorService.search(fullName, email, specialization, active, available, pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DoctorResponse> update(@PathVariable String id, @Valid @RequestBody DoctorUpdateRequest request) {
        return ResponseEntity.ok(doctorService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        doctorService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
