package com.clinic.controller;

import com.clinic.dto.request.UpdateLabNotificationReadRequest;
import com.clinic.dto.response.LabNotificationResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.service.LabNotificationService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/lab-notifications")
@Slf4j
public class LabNotificationController {

    private final LabNotificationService labNotificationService;

    public LabNotificationController(LabNotificationService labNotificationService) {
        this.labNotificationService = labNotificationService;
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('DOCTOR', 'LABORATORY', 'ADMIN')")
    public ResponseEntity<LabNotificationResponse> getById(@PathVariable String id) {
        return ResponseEntity.ok(labNotificationService.getById(id));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('DOCTOR', 'LABORATORY', 'ADMIN')")
    public ResponseEntity<PageResponse<LabNotificationResponse>> getByUser(
            @RequestParam String userId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) @ParameterObject Pageable pageable
    ) {
        Page<LabNotificationResponse> page = labNotificationService.getByUserId(userId, pageable);
        return ResponseEntity.ok(PageResponse.of(page));
    }

    @GetMapping("/unread/{userId}")
    @PreAuthorize("hasAnyRole('DOCTOR', 'LABORATORY', 'ADMIN')")
    public ResponseEntity<List<LabNotificationResponse>> getUnreadByUser(@PathVariable String userId) {
        return ResponseEntity.ok(labNotificationService.getUnreadByUserId(userId));
    }

    @GetMapping("/unread-count/{userId}")
    @PreAuthorize("hasAnyRole('DOCTOR', 'LABORATORY', 'ADMIN')")
    public ResponseEntity<Long> getUnreadCount(@PathVariable String userId) {
        return ResponseEntity.ok(labNotificationService.getUnreadCountByUserId(userId));
    }

    @PatchMapping("/{id}/read")
    @PreAuthorize("hasAnyRole('DOCTOR', 'LABORATORY', 'ADMIN')")
    public ResponseEntity<LabNotificationResponse> markAsRead(
            @PathVariable String id,
            @Valid @RequestBody UpdateLabNotificationReadRequest request
    ) {
        log.info("Mark notification as {} id={}", request.isRead() ? "read" : "unread", id);
        return ResponseEntity.ok(labNotificationService.markAsRead(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        labNotificationService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
