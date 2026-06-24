package com.clinic.controller;

import com.clinic.dto.request.DoctorAvailabilityCreateRequest;
import com.clinic.dto.response.DoctorAvailabilityResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.service.DoctorAvailabilityService;
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
@RequestMapping("/api/v1/doctor-availability")
public class DoctorAvailabilityController {

    private final DoctorAvailabilityService availabilityService;

    public DoctorAvailabilityController(DoctorAvailabilityService availabilityService) {
        this.availabilityService = availabilityService;
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DoctorAvailabilityResponse> create(@Valid @RequestBody DoctorAvailabilityCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(availabilityService.create(request));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public ResponseEntity<DoctorAvailabilityResponse> getById(@PathVariable String id) {
        return ResponseEntity.ok(availabilityService.getById(id));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public ResponseEntity<PageResponse<DoctorAvailabilityResponse>> getAll(
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<DoctorAvailabilityResponse> page = availabilityService.getAll(pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @GetMapping("/doctor/{doctorId}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public ResponseEntity<PageResponse<DoctorAvailabilityResponse>> getByDoctorId(
            @PathVariable String doctorId,
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<DoctorAvailabilityResponse> page = availabilityService.getByDoctorId(doctorId, pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @GetMapping("/laboratory/{laboratoryId}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public ResponseEntity<PageResponse<DoctorAvailabilityResponse>> getByLaboratoryId(
            @PathVariable String laboratoryId,
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<DoctorAvailabilityResponse> page = availabilityService.getByLaboratoryId(laboratoryId, pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @GetMapping("/day/{dayOfWeek}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public ResponseEntity<PageResponse<DoctorAvailabilityResponse>> getByDayOfWeek(
            @PathVariable String dayOfWeek,
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<DoctorAvailabilityResponse> page = availabilityService.getByDayOfWeek(dayOfWeek, pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DoctorAvailabilityResponse> update(@PathVariable String id, @Valid @RequestBody DoctorAvailabilityCreateRequest request) {
        return ResponseEntity.ok(availabilityService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        availabilityService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
