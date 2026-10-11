package com.clinic.controller;

import com.clinic.config.ApiPaths;
import com.clinic.dto.request.PatientCreateRequest;
import com.clinic.dto.request.PatientUpdateRequest;
import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.PatientResponse;
import com.clinic.security.CurrentUser;
import com.clinic.service.PatientService;
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

import com.clinic.entity.UserRole;
import org.springframework.security.access.AccessDeniedException;

/**
 * Patient endpoints.
 *
 * <p>Reads are scoped: a doctor may only open a patient assigned to them, and a
 * patient may only open their own record. The id in the path is never trusted as
 * an authorisation decision — the check is always against the caller's identity.
 */
@RestController
@RequestMapping(ApiPaths.PATIENTS)
@Slf4j
public class PatientController {

    private final PatientService patientService;
    private final CurrentUser currentUser;

    public PatientController(PatientService patientService, CurrentUser currentUser) {
        this.patientService = patientService;
        this.currentUser = currentUser;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PERM_patient:register')")
    public ResponseEntity<PatientResponse> create(@Valid @RequestBody PatientCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(patientService.create(request));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_patient:demographics:read') or hasAuthority('PERM_own_record:read')")
    public ResponseEntity<PatientResponse> getById(@PathVariable String id) {
        assertCanAccess(id);
        return ResponseEntity.ok(patientService.getById(id));
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('PERM_patient:demographics:read','PERM_patient:directory:read') and !hasRole('PATIENT')")
    public ResponseEntity<PageResponse<PatientResponse>> getAll(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
            @ParameterObject Pageable pageable
    ) {
        Page<PatientResponse> page = patientService.getAll(pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyAuthority('PERM_patient:demographics:read','PERM_patient:directory:read') and !hasRole('PATIENT')")
    public ResponseEntity<PageResponse<PatientResponse>> search(
            @RequestParam(required = false) String fullName,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) Boolean active,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
            @ParameterObject Pageable pageable
    ) {
        Page<PatientResponse> page = patientService.search(fullName, email, phone, active, pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('PERM_user:manage','PERM_patient:demographics:read')")
    public ResponseEntity<PatientResponse> update(@PathVariable String id,
                                                  @Valid @RequestBody PatientUpdateRequest request) {
        // A patient may only edit their own record.
        if (currentUser.is(UserRole.PATIENT) && !currentUser.userId().equals(id)) {
            throw new AccessDeniedException("You may only update your own patient record");
        }
        return ResponseEntity.ok(patientService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('PERM_user:manage')")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        patientService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * A doctor sees only assigned patients; other staff roles allowed here can
     * read demographics. Patients only ever see themselves.
     */
    private void assertCanAccess(String patientId) {
        UserRole role = currentUser.role();
        if (role == UserRole.PATIENT) {
            if (!currentUser.userId().equals(patientId)) {
                throw new AccessDeniedException("You may only view your own patient record");
            }
            return;
        }
        if (role == UserRole.DOCTOR && !patientService.patientsAssignedTo(currentUser.userId(),
                org.springframework.data.domain.PageRequest.of(0, 1)).stream()
                .anyMatch(patient -> patient.id().equals(patientId))) {
            throw new AccessDeniedException("This patient is not assigned to you");
        }
    }
}