package com.clinic.controller;

import com.clinic.dto.response.GlobalSearchResponse;
import com.clinic.service.GlobalSearchService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Administration read model: global search.
 *
 * <p>The audit-log endpoint already lives on {@link AdminController}; this class
 * exists so search stays separate from the user/role mutation endpoints.
 */
@RestController
@RequestMapping("/api/v1/admin")
@Slf4j
public class AdminQueryController {

    private final GlobalSearchService globalSearchService;

    public AdminQueryController(GlobalSearchService globalSearchService) {
        this.globalSearchService = globalSearchService;
    }

    /**
     * Cross-entity search. Available to any authenticated user because the service
     * scopes every section to the caller's permissions — a patient searching
     * "smith" sees their own record, never the user directory.
     */
    @GetMapping("/search")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<GlobalSearchResponse> search(
            @RequestParam String q,
            @RequestParam(defaultValue = "5") int limit) {
        return ResponseEntity.ok(globalSearchService.search(q, limit));
    }
}