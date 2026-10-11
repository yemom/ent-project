package com.clinic.controller;

import com.clinic.dto.request.AdmissionCreateRequest;
import com.clinic.dto.request.DepartmentUpsertRequest;
import com.clinic.dto.request.RoomUpsertRequest;
import com.clinic.dto.request.WardUpsertRequest;
import com.clinic.dto.response.DepartmentResponse;
import com.clinic.entity.Admission;
import com.clinic.service.HospitalOperationsService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springdoc.core.annotations.ParameterObject;
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

import java.util.List;

/**
 * Departments, wards, rooms and admissions.
 *
 * <p>Reads need only authentication because bed availability is shared across the
 * front desk and the wards board. Writes are permission-gated, and admissions
 * require {@code admission:write}, which only a doctor holds.
 */
@RestController
@RequestMapping("/api/v1/hospital")
@Slf4j
public class HospitalOperationsController {

    private final HospitalOperationsService operationsService;

    public HospitalOperationsController(HospitalOperationsService operationsService) {
        this.operationsService = operationsService;
    }

    // ---------------- Departments ----------------

    @GetMapping("/departments")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<DepartmentResponse>> listDepartments() {
        return ResponseEntity.ok(operationsService.listDepartments());
    }

    @PostMapping("/departments")
    @PreAuthorize("hasAuthority('PERM_department:manage')")
    public ResponseEntity<DepartmentResponse> createDepartment(
            @Valid @RequestBody DepartmentUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(operationsService.createDepartment(request));
    }

    @PutMapping("/departments/{id}")
    @PreAuthorize("hasAuthority('PERM_department:manage')")
    public ResponseEntity<DepartmentResponse> updateDepartment(
            @PathVariable String id, @Valid @RequestBody DepartmentUpsertRequest request) {
        return ResponseEntity.ok(operationsService.updateDepartment(id, request));
    }

    @DeleteMapping("/departments/{id}")
    @PreAuthorize("hasAuthority('PERM_department:manage')")
    public ResponseEntity<Void> deleteDepartment(@PathVariable String id) {
        operationsService.deleteDepartment(id);
        return ResponseEntity.noContent().build();
    }

    // ---------------- Wards ----------------

    @GetMapping("/wards")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<com.clinic.dto.response.PageResponse<DepartmentResponse.WardResponse>> listWards(
            @RequestParam(required = false) String departmentId,
            @PageableDefault(size = 20, sort = "name", direction = Sort.Direction.ASC)
            @ParameterObject Pageable pageable) {
        return ResponseEntity.ok(com.clinic.dto.response.PageResponse.of(
                operationsService.listWards(departmentId, pageable)));
    }

    @PostMapping("/wards")
    @PreAuthorize("hasAuthority('PERM_ward:manage')")
    public ResponseEntity<DepartmentResponse.WardResponse> createWard(
            @Valid @RequestBody WardUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(operationsService.createWard(request));
    }

    @PutMapping("/wards/{id}")
    @PreAuthorize("hasAuthority('PERM_ward:manage')")
    public ResponseEntity<DepartmentResponse.WardResponse> updateWard(
            @PathVariable String id, @Valid @RequestBody WardUpsertRequest request) {
        return ResponseEntity.ok(operationsService.updateWard(id, request));
    }

    @DeleteMapping("/wards/{id}")
    @PreAuthorize("hasAuthority('PERM_ward:manage')")
    public ResponseEntity<Void> deleteWard(@PathVariable String id) {
        operationsService.deleteWard(id);
        return ResponseEntity.noContent().build();
    }

    // ---------------- Rooms ----------------

    @GetMapping("/rooms")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<com.clinic.dto.response.PageResponse<DepartmentResponse.RoomResponse>> listRooms(
            @RequestParam(required = false) String wardId,
            @PageableDefault(size = 20, sort = "name", direction = Sort.Direction.ASC)
            @ParameterObject Pageable pageable) {
        return ResponseEntity.ok(com.clinic.dto.response.PageResponse.of(
                operationsService.listRooms(wardId, pageable)));
    }

    @PostMapping("/rooms")
    @PreAuthorize("hasAuthority('PERM_room:manage')")
    public ResponseEntity<DepartmentResponse.RoomResponse> createRoom(
            @Valid @RequestBody RoomUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(operationsService.createRoom(request));
    }

    @PutMapping("/rooms/{id}")
    @PreAuthorize("hasAuthority('PERM_room:manage')")
    public ResponseEntity<DepartmentResponse.RoomResponse> updateRoom(
            @PathVariable String id, @Valid @RequestBody RoomUpsertRequest request) {
        return ResponseEntity.ok(operationsService.updateRoom(id, request));
    }

    @DeleteMapping("/rooms/{id}")
    @PreAuthorize("hasAuthority('PERM_room:manage')")
    public ResponseEntity<Void> deleteRoom(@PathVariable String id) {
        operationsService.deleteRoom(id);
        return ResponseEntity.noContent().build();
    }

    // ---------------- Admissions ----------------

    @GetMapping("/admissions")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<com.clinic.dto.response.PageResponse<DepartmentResponse.AdmissionResponse>>
            listAdmissions(
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20, sort = "admittedAt", direction = Sort.Direction.DESC)
            @ParameterObject Pageable pageable) {
        Admission.Status filter = status == null || status.isBlank()
                ? null
                : Admission.Status.valueOf(status.toUpperCase());
        return ResponseEntity.ok(com.clinic.dto.response.PageResponse.of(
                operationsService.listAdmissions(filter, pageable)));
    }

    /** Beds board: everyone currently admitted. */
    @GetMapping("/admissions/open")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<DepartmentResponse.AdmissionResponse>> openAdmissions() {
        return ResponseEntity.ok(operationsService.openAdmissions());
    }

    @PostMapping("/admissions")
    @PreAuthorize("hasAuthority('PERM_admission:write')")
    public ResponseEntity<DepartmentResponse.AdmissionResponse> admit(
            @Valid @RequestBody AdmissionCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(operationsService.admit(request));
    }

    @PostMapping("/admissions/{id}/discharge")
    @PreAuthorize("hasAuthority('PERM_admission:write')")
    public ResponseEntity<DepartmentResponse.AdmissionResponse> discharge(@PathVariable String id) {
        return ResponseEntity.ok(operationsService.discharge(id));
    }
}