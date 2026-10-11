package com.clinic.controller;

import com.clinic.dto.request.ChangeRoleRequest;
import com.clinic.dto.request.ChangeStatusRequest;
import com.clinic.dto.request.CreateUserRequest;
import com.clinic.dto.request.UpdateUserRequest;
import com.clinic.dto.response.CreateUserResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.RoleChangeRequestResponse;
import com.clinic.dto.response.UserResponse;
import com.clinic.dto.response.UserSummaryResponse;
import com.clinic.entity.AuditAction;
import com.clinic.entity.RoleChangeRequest;
import com.clinic.entity.UserRole;
import com.clinic.service.AdminService;
import com.clinic.service.AuditLogService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Platform administration. Access is permission-driven rather than
 * role-name-driven so adding a role never requires editing the expression here.
 */
@RestController
@RequestMapping("/api/v1/admin")
@Slf4j
public class AdminController {

    private final AdminService adminService;
    private final AuditLogService auditLogService;

    public AdminController(AdminService adminService, AuditLogService auditLogService) {
        this.adminService = adminService;
        this.auditLogService = auditLogService;
    }

    @GetMapping("/users")
    @PreAuthorize("hasAuthority('PERM_user:manage')")
    public ResponseEntity<PageResponse<UserResponse>> listUsers(
            @RequestParam(required = false) UserRole role,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) Boolean status,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String branchId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String search,
            @ParameterObject Pageable pageable) {
        Boolean activeFilter = active != null ? active : status;
        String searchFilter = search != null && !search.isBlank() ? search : q;
        log.debug("Admin listing users role={} active={} dept={} search={}", role, activeFilter, department, searchFilter);
        return ResponseEntity.ok(adminService.searchUsers(role, activeFilter, branchId, department, searchFilter, pageable));
    }

    @GetMapping("/users/search")
    @PreAuthorize("hasAuthority('PERM_user:manage')")
    public ResponseEntity<PageResponse<UserResponse>> searchUsers(
            @RequestParam(required = false) UserRole role,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) Boolean status,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String branchId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String search,
            @ParameterObject Pageable pageable) {
        return listUsers(role, active, status, department, branchId, q, search, pageable);
    }

    @GetMapping("/users/{id}")
    @PreAuthorize("hasAuthority('PERM_user:manage')")
    public ResponseEntity<UserResponse> getUser(@PathVariable String id) {
        return ResponseEntity.ok(adminService.getUser(id));
    }

    @PostMapping("/users")
    @PreAuthorize("hasAuthority('PERM_user:manage')")
    public ResponseEntity<CreateUserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
        log.info("Admin creating user with email={} role={}", request.email(), request.role());
        return ResponseEntity.status(HttpStatus.CREATED).body(adminService.createAccount(request));
    }

    @PostMapping("/users/accounts")
    @PreAuthorize("hasAuthority('PERM_user:manage')")
    public ResponseEntity<CreateUserResponse> createAccount(@Valid @RequestBody CreateUserRequest request) {
        return createUser(request);
    }

    @PutMapping("/users/{id}")
    @PreAuthorize("hasAuthority('PERM_user:manage')")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable String id,
            @Valid @RequestBody UpdateUserRequest request) {
        log.info("Admin updating user id={}", id);
        return ResponseEntity.ok(adminService.updateProfile(id, request));
    }

    @PutMapping("/users/{id}/profile")
    @PreAuthorize("hasAuthority('PERM_user:manage')")
    public ResponseEntity<UserResponse> updateProfile(
            @PathVariable String id,
            @Valid @RequestBody UpdateUserRequest request) {
        return updateUser(id, request);
    }

    @PatchMapping("/users/{id}/role")
    @PreAuthorize("hasAuthority('PERM_user:manage')")
    public ResponseEntity<UserResponse> changeRole(
            @PathVariable String id,
            @Valid @RequestBody ChangeRoleRequest request) {
        log.info("Admin changing role for id={} to {}", id, request.role());
        return ResponseEntity.ok(adminService.changeRole(id, request));
    }

    @PatchMapping("/users/{id}/status")
    @PreAuthorize("hasAuthority('PERM_user:manage')")
    public ResponseEntity<UserResponse> changeStatus(
            @PathVariable String id,
            @Valid @RequestBody ChangeStatusRequest request) {
        log.info("Admin changing status for id={} to active={}", id, request.active());
        return ResponseEntity.ok(adminService.changeStatus(id, request));
    }

    @DeleteMapping("/users/{id}")
    @PreAuthorize("hasAuthority('PERM_user:manage')")
    public ResponseEntity<Void> deleteUser(@PathVariable String id) {
        log.info("Admin deleting user id={}", id);
        adminService.softDeleteAccount(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{id}/account")
    @PreAuthorize("hasAuthority('PERM_user:manage')")
    public ResponseEntity<Void> softDeleteAccount(@PathVariable String id) {
        return deleteUser(id);
    }

    /** Permission matrix, served to the frontend so both layers share one list. */
    @GetMapping("/permissions")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<java.util.Map<UserRole, java.util.Set<String>>> permissions() {
        java.util.Map<UserRole, java.util.Set<String>> matrix = new java.util.EnumMap<>(UserRole.class);
        for (UserRole role : UserRole.values()) {
            matrix.put(role, adminService.permissionsFor(role));
        }
        return ResponseEntity.ok(matrix);
    }

    // ---------------- Role changes: dual approval ----------------

    @PostMapping("/users/{id}/role-requests")
    @PreAuthorize("hasAuthority('PERM_role:manage')")
    public ResponseEntity<RoleChangeRequestResponse> requestRoleChange(
            @PathVariable String id,
            @RequestParam UserRole role,
            @RequestParam String reason) {
        log.info("Role change requested for user {} -> {}", id, role);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(adminService.requestRoleChange(id, role, reason));
    }

    @GetMapping("/role-requests")
    @PreAuthorize("hasAuthority('PERM_role:manage')")
    public ResponseEntity<PageResponse<RoleChangeRequestResponse>> listRoleChangeRequests(
            @RequestParam(required = false) String status,
            @ParameterObject Pageable pageable) {
        RoleChangeRequest.Status statusFilter = status == null || status.isBlank()
                ? null
                : RoleChangeRequest.Status.valueOf(status.toUpperCase());
        return ResponseEntity.ok(adminService.listRoleChangeRequests(statusFilter, pageable));
    }

    @PostMapping("/role-requests/{requestId}/approve")
    @PreAuthorize("hasAuthority('PERM_role:manage')")
    public ResponseEntity<RoleChangeRequestResponse> approveRoleChange(
            @PathVariable String requestId,
            @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(adminService.approveRoleChange(requestId, reason));
    }

    @PostMapping("/role-requests/{requestId}/reject")
    @PreAuthorize("hasAuthority('PERM_role:manage')")
    public ResponseEntity<RoleChangeRequestResponse> rejectRoleChange(
            @PathVariable String requestId,
            @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(adminService.rejectRoleChange(requestId, reason));
    }

    // ---------------- Audit log ----------------

    @GetMapping("/audit-logs")
    @PreAuthorize("hasAuthority('PERM_audit:read')")
    public ResponseEntity<PageResponse<com.clinic.dto.response.AuditLogResponse>> listAuditLogs(
            @RequestParam(required = false) String action,
            @ParameterObject Pageable pageable) {
        AuditAction parsed = AuditAction.from(action);
        var page = parsed != null
                ? auditLogService.listByAction(parsed, pageable)
                : auditLogService.list(pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }
}