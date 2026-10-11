package com.clinic.controller;

import com.clinic.dto.response.HospitalStatsResponse;
import com.clinic.service.impl.HospitalStatsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Aggregate statistics for the administration dashboards.
 *
 * <p>Guarded by {@code report:read} rather than a role name so both Super Admin
 * and Hospital Admin can read them, and no clinical role can.
 */
@RestController
@RequestMapping("/api/v1/stats")
@Slf4j
public class StatsController {

    private final HospitalStatsService statsService;

    public StatsController(HospitalStatsService statsService) {
        this.statsService = statsService;
    }

    @GetMapping("/hospital")
    @PreAuthorize("hasAuthority('PERM_report:read')")
    public ResponseEntity<HospitalStatsResponse> hospital() {
        return ResponseEntity.ok(statsService.hospitalStats());
    }
}