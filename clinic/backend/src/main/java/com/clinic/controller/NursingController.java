package com.clinic.controller;

import com.clinic.dto.request.NurseObservationRequest;
import com.clinic.dto.response.NurseObservationResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.entity.NurseObservation;
import com.clinic.service.NurseObservationService;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Nursing observations: vitals, nursing notes, medication administration.
 *
 * <p>Write access requires {@code vital:write} (nurse) and medication
 * administration requires {@code medication:administer}. Neither grants any
 * diagnostic or prescribing capability.
 */
@RestController
@RequestMapping("/api/v1/nursing")
@Slf4j
public class NursingController {

    private final NurseObservationService observationService;

    public NursingController(NurseObservationService observationService) {
        this.observationService = observationService;
    }

    @GetMapping("/observations")
    @PreAuthorize("hasAuthority('PERM_vital:write') or hasAuthority('PERM_diagnosis:write')")
    public ResponseEntity<PageResponse<NurseObservationResponse>> list(
            @RequestParam(required = false) String patientId,
            @RequestParam(required = false) String kind,
            @PageableDefault(size = 20, sort = "observedAt", direction = Sort.Direction.DESC)
            @ParameterObject Pageable pageable) {
        NurseObservation.Kind filter = kind == null || kind.isBlank()
                ? null
                : NurseObservation.Kind.valueOf(kind.toUpperCase());
        return ResponseEntity.ok(observationService.list(patientId, filter, pageable));
    }

    @PostMapping("/observations")
    @PreAuthorize("hasAuthority('PERM_vital:write') or hasAuthority('PERM_medication:administer')")
    public ResponseEntity<NurseObservationResponse> record(
            @Valid @RequestBody NurseObservationRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(observationService.record(request));
    }

    @DeleteMapping("/observations/{id}")
    @PreAuthorize("hasAuthority('PERM_vital:write')")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        observationService.delete(id);
        return ResponseEntity.noContent().build();
    }
}