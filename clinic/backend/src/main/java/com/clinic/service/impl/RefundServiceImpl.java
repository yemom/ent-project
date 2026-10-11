package com.clinic.service.impl;

import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.RefundRequestResponse;
import com.clinic.entity.RefundRequest;
import com.clinic.exception.BadRequestException;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.repository.RefundRequestRepository;
import com.clinic.security.CurrentUser;
import com.clinic.service.RefundService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Refunds with dual approval above a threshold.
 *
 * <p>Two separate controls:
 * <ul>
 *   <li>amount > threshold ⇒ status stays PENDING_APPROVAL and needs a second
 *       privileged user with {@code refund:approve}.</li>
 *   <li>the approver must not be the requester (separation of duties).</li>
 * </ul>
 */
@Service
@Transactional
@Slf4j
public class RefundServiceImpl implements RefundService {

    private final RefundRequestRepository refundRequestRepository;
    private final CurrentUser currentUser;

    @Value("${app.security.refund-approval-threshold:500.00}")
    private BigDecimal approvalThreshold = new BigDecimal("500.00");

    public RefundServiceImpl(RefundRequestRepository refundRequestRepository, CurrentUser currentUser) {
        this.refundRequestRepository = refundRequestRepository;
        this.currentUser = currentUser;
    }

    @Override
    public RefundRequestResponse requestRefund(String invoiceId, BigDecimal amount, String reason) {
        if (amount == null || amount.signum() <= 0) {
            throw new BadRequestException("Refund amount must be greater than zero");
        }
        if (reason == null || reason.isBlank()) {
            throw new BadRequestException("A reason is required for a refund");
        }

        boolean requiresApproval = amount.compareTo(threshold()) > 0;

        RefundRequest request = RefundRequest.builder()
                .id(UUID.randomUUID().toString())
                .invoiceId(invoiceId)
                .amount(amount)
                .requiresApproval(requiresApproval)
                .status(requiresApproval
                        ? RefundRequest.Status.PENDING_APPROVAL
                        : RefundRequest.Status.APPROVED)
                .requestedById(currentUser.userId())
                .requestedByEmail(currentUser.require().getUsername())
                .reason(reason)
                .requestedAt(LocalDateTime.now())
                // Small refunds are self-approved, recorded here for the audit trail.
                .approvedById(requiresApproval ? null : currentUser.userId())
                .approvedByEmail(requiresApproval ? null : currentUser.require().getUsername())
                .decidedAt(requiresApproval ? null : LocalDateTime.now())
                .build();

        RefundRequest saved = refundRequestRepository.save(request);
        log.info("Refund {} requested for invoice {} amount={} requiresApproval={}",
                saved.getId(), invoiceId, amount, requiresApproval);
        return RefundRequestResponse.from(saved);
    }

    @Override
    public RefundRequestResponse approve(String requestId, String decisionReason) {
        RefundRequest request = getPendingRequest(requestId);
        requireDistinctApprover(request);

        request.setStatus(RefundRequest.Status.APPROVED);
        request.setApprovedById(currentUser.userId());
        request.setApprovedByEmail(currentUser.require().getUsername());
        request.setDecisionReason(decisionReason);
        request.setDecidedAt(LocalDateTime.now());

        log.info("Refund {} approved by {}", requestId, currentUser.userId());
        return RefundRequestResponse.from(refundRequestRepository.save(request));
    }

    @Override
    public RefundRequestResponse reject(String requestId, String decisionReason) {
        RefundRequest request = getPendingRequest(requestId);
        requireDistinctApprover(request);

        request.setStatus(RefundRequest.Status.REJECTED);
        request.setApprovedById(currentUser.userId());
        request.setApprovedByEmail(currentUser.require().getUsername());
        request.setDecisionReason(decisionReason);
        request.setDecidedAt(LocalDateTime.now());

        log.info("Refund {} rejected by {}", requestId, currentUser.userId());
        return RefundRequestResponse.from(refundRequestRepository.save(request));
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<RefundRequestResponse> list(RefundRequest.Status status, Pageable pageable) {
        Page<RefundRequest> page = status != null
                ? refundRequestRepository.findByStatusOrderByRequestedAtDesc(status, pageable)
                : refundRequestRepository.findAllByOrderByRequestedAtDesc(pageable);
        return PageResponse.of(page.map(RefundRequestResponse::from));
    }

    private RefundRequest getPendingRequest(String requestId) {
        RefundRequest request = refundRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Refund request not found: " + requestId));
        if (request.getStatus() != RefundRequest.Status.PENDING_APPROVAL) {
            throw new BadRequestException("This refund has already been decided");
        }
        return request;
    }

    private void requireDistinctApprover(RefundRequest request) {
        if (request.getRequestedById() != null && request.getRequestedById().equals(currentUser.userId())) {
            throw new BadRequestException("A refund must be approved by a different privileged user");
        }
    }

    private BigDecimal threshold() {
        return approvalThreshold == null ? new BigDecimal("500.00") : approvalThreshold;
    }
}