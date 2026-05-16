package com.clinic.controller;

import com.clinic.config.ApiPaths;
import com.clinic.dto.request.AppointmentCreateRequest;
import com.clinic.dto.request.AppointmentSearchRequest;
import com.clinic.dto.request.AppointmentUpdateRequest;
import com.clinic.dto.response.AppointmentResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.entity.AppointmentStatus;
import com.clinic.service.AppointmentService;
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

import java.time.LocalDateTime;

@RestController
@RequestMapping(ApiPaths.APPOINTMENTS)
public class AppointmentController {

    private final AppointmentService appointmentService;

    public AppointmentController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public ResponseEntity<AppointmentResponse> create(@Valid @RequestBody AppointmentCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(appointmentService.create(request));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public ResponseEntity<AppointmentResponse> getById(@PathVariable String id) {
        return ResponseEntity.ok(appointmentService.getById(id));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public ResponseEntity<PageResponse<AppointmentResponse>> getAll(
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<AppointmentResponse> page = appointmentService.getAll(pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public ResponseEntity<PageResponse<AppointmentResponse>> search(
            @RequestParam(required = false) String patientId,
            @RequestParam(required = false) String doctorId,
            @RequestParam(required = false) AppointmentStatus status,
            @RequestParam(required = false) LocalDateTime from,
            @RequestParam(required = false) LocalDateTime to,
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        AppointmentSearchRequest request = new AppointmentSearchRequest(patientId, doctorId, status, from, to, keyword);
        Page<AppointmentResponse> page = appointmentService.search(request, pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR')")
    public ResponseEntity<AppointmentResponse> update(@PathVariable String id, @Valid @RequestBody AppointmentUpdateRequest request) {
        return ResponseEntity.ok(appointmentService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','DOCTOR','PATIENT')")
    public ResponseEntity<Void> delete(@PathVariable String id, @RequestParam(required = false) String reason) {
        if (reason != null && !reason.isBlank()) {
            appointmentService.cancel(id, reason);
        } else {
            appointmentService.delete(id);
        }
        return ResponseEntity.noContent().build();
    }
}
