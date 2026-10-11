package com.clinic.service.impl;

import com.clinic.dto.response.AuditLogResponse;
import com.clinic.entity.AuditAction;
import com.clinic.entity.AuditLog;
import com.clinic.repository.AuditLogRepository;
import com.clinic.security.CurrentUser;
import com.clinic.security.CustomUserPrincipal;
import com.clinic.service.AuditLogService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@Slf4j
public class AuditLogServiceImpl implements AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final CurrentUser currentUser;

    public AuditLogServiceImpl(AuditLogRepository auditLogRepository, CurrentUser currentUser) {
        this.auditLogRepository = auditLogRepository;
        this.currentUser = currentUser;
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(AuditAction action, String targetType, String targetId, String reason) {
        record(action, targetType, targetId, reason, Map.of());
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(AuditAction action, String targetType, String targetId, String reason,
                       Map<String, Object> metadata) {
        try {
            var authentication = org.springframework.security.core.context.SecurityContextHolder
                    .getContext().getAuthentication();
            if (authentication == null || !(authentication.getPrincipal() instanceof CustomUserPrincipal principal)) {
                return;
            }
            recordAs(principal, action, targetType, targetId, reason, null, metadata);
        } catch (Exception e) {
            // Never let an audit problem break the business operation.
            log.error("Failed to write audit log action={} target={}/{}", action, targetType, targetId, e);
        }
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordAs(CustomUserPrincipal principal, AuditAction action, String targetType,
                         String targetId, String reason, String ipAddress) {
        recordAs(principal, action, targetType, targetId, reason, ipAddress, Map.of());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordAs(CustomUserPrincipal principal, AuditAction action, String targetType,
                         String targetId, String reason, String ipAddress, Map<String, Object> metadata) {
        try {
            AuditLog entry = AuditLog.builder()
                    .actorId(principal.getUserId())
                    .actorEmail(principal.getUsername())
                    .actorRole(principal.getUser().getRole())
                    .action(action)
                    .targetType(targetType)
                    .targetId(targetId)
                    .branchId(branchOf(principal))
                    .reason(reason)
                    .ipAddress(ipAddress)
                    .metadata(serialize(metadata))
                    .build();
            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.error("Failed to write audit log action={} target={}/{}", action, targetType, targetId, e);
        }
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordAnonymous(String email, AuditAction action, String targetType,
                                String targetId, String reason, String ipAddress) {
        try {
            AuditLog entry = AuditLog.builder()
                    .actorEmail(email)
                    .action(action)
                    .targetType(targetType)
                    .targetId(targetId)
                    .reason(reason)
                    .ipAddress(ipAddress)
                    .build();
            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.error("Failed to write anonymous audit log action={} email={}", action, email, e);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLogResponse> list(Pageable pageable) {
        return auditLogRepository.findAllByOrderByCreatedAtDesc(pageable).map(AuditLogResponse::from);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLogResponse> listByAction(AuditAction action, Pageable pageable) {
        return auditLogRepository.findByActionOrderByCreatedAtDesc(action, pageable).map(AuditLogResponse::from);
    }

    private String branchOf(CustomUserPrincipal principal) {
        // Only patients carry a branch on this table; staff branch scoping is
        // applied by the services that own clinical data.
        return principal.getUser() instanceof com.clinic.entity.Patient patient ? patient.getBranchId() : null;
    }

    private String serialize(Map<String, Object> metadata) {
        if (metadata == null || metadata.isEmpty()) {
            return null;
        }
        return metadata.entrySet().stream()
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .collect(java.util.stream.Collectors.joining(", "));
    }
}