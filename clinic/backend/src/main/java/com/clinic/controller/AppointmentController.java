package com.clinic.controller;

import com.clinic.config.ApiPaths;
import com.clinic.dto.request.AppointmentCreateRequest;
import com.clinic.dto.request.AppointmentSearchRequest;
import com.clinic.dto.request.AppointmentStatusRequest;
import com.clinic.dto.request.AppointmentUpdateRequest;
import com.clinic.dto.response.AppointmentResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.entity.AppointmentStatus;
import com.clinic.security.Permissions;
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

/**
 * Appointment scheduling.
 *
 * <p>Authorisation derives from {@link Permissions#APPOINTMENT_MANAGE} rather than
 * a hand-written role list. The previous literals named {@code ADMIN, DOCTOR,
 * PATIENT} — which excluded the receptionist and the hospital admin even though
 * {@code RolePermissions} grants both of them {@code appointment:manage} and the
 * frontend renders an Appointments screen for each. Anyone following the navigation
 * therefore hit a 403 on a page the application had just linked them to.
 *
 * <p>DOCTOR is kept explicitly because a clinician is not a scheduler: they read
 * and update their own panel rather than the clinic-wide book. The service scopes
 * every read and write to that panel, so the role grant widens nothing.
 */
@RestController
@RequestMapping(ApiPaths.APPOINTMENTS)
public class AppointmentController {

    private static final String SCHEDULER = "hasAuthority('PERM_" + Permissions.APPOINTMENT_MANAGE + "')";

    private final AppointmentService appointmentService;

    public AppointmentController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    /**
     * Books an appointment.
     *
     * <p>A patient holds {@code appointment:manage} too, so the service pins
     * {@code patientId} to the caller rather than trusting the body.
     */
    @PostMapping
    @PreAuthorize(SCHEDULER)
    public ResponseEntity<AppointmentResponse> create(@Valid @RequestBody AppointmentCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(appointmentService.create(request));
    }

    @GetMapping("/{id}")
    @PreAuthorize(SCHEDULER + " or hasRole('DOCTOR')")
    public ResponseEntity<AppointmentResponse> getById(@PathVariable String id) {
        return ResponseEntity.ok(appointmentService.getById(id));
    }

    @GetMapping
    @PreAuthorize(SCHEDULER + " or hasRole('DOCTOR')")
    public ResponseEntity<PageResponse<AppointmentResponse>> getAll(
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<AppointmentResponse> page = appointmentService.getAll(pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    /**
     * Filtered listing.
     *
     * <p>{@code from}/{@code to} are ISO-8601 local date-times and half-open in
     * practice: {@code from} is inclusive, {@code to} inclusive, which is what the
     * date-range picker in the reception screen sends.
     */
    @GetMapping("/search")
    @PreAuthorize(SCHEDULER + " or hasRole('DOCTOR')")
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

    /** Reschedule: new slot, doctor, duration, reason or notes. Never the status. */
    @PutMapping("/{id}")
    @PreAuthorize(SCHEDULER + " or hasRole('DOCTOR')")
    public ResponseEntity<AppointmentResponse> update(@PathVariable String id, @Valid @RequestBody AppointmentUpdateRequest request) {
        return ResponseEntity.ok(appointmentService.update(id, request));
    }

    /**
     * Moves an appointment through its lifecycle.
     *
     * <p>Excluded for patients: they may cancel their own booking but have no
     * business confirming or completing it. The same {@code and !hasRole('PATIENT')}
     * guard the patient directory uses.
     */
    @PutMapping("/{id}/status")
    @PreAuthorize(SCHEDULER + " and !hasRole('PATIENT')")
    public ResponseEntity<AppointmentResponse> changeStatus(
            @PathVariable String id,
            @Valid @RequestBody AppointmentStatusRequest request
    ) {
        return ResponseEntity.ok(appointmentService.changeStatus(id, request));
    }

    /**
     * With a {@code reason}, cancels the appointment and keeps the record. Without
     * one, removes the row outright — which is why the destructive form is reserved
     * for schedulers.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("(" + SCHEDULER + " and !hasRole('PATIENT')) or hasRole('DOCTOR')")
    public ResponseEntity<Void> delete(@PathVariable String id, @RequestParam(required = false) String reason) {
        if (reason != null && !reason.isBlank()) {
            appointmentService.cancel(id, reason);
        } else {
            appointmentService.delete(id);
        }
        return ResponseEntity.noContent().build();
    }
}