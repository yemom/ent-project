package com.clinic.controller;

import com.clinic.dto.request.CreateUserRequest;
import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.UserSummaryResponse;
import com.clinic.service.AdminService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('ADMIN')")
@Slf4j
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/users")
    public ResponseEntity<PageResponse<UserSummaryResponse>> listUsers(Pageable pageable) {
        log.debug("Admin listing users page={} size={}", pageable.getPageNumber(), pageable.getPageSize());
        return ResponseEntity.ok(adminService.listUsers(pageable));
    }

    @PostMapping("/users")
    public ResponseEntity<UserSummaryResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        log.info("Admin creating user with email={} role={}", request.email(), request.role());
        return ResponseEntity.status(HttpStatus.CREATED).body(adminService.createUser(request));
    }
}
