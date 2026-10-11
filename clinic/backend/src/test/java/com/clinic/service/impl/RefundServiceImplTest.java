package com.clinic.service.impl;

import com.clinic.dto.response.RefundRequestResponse;
import com.clinic.entity.AdminUser;
import com.clinic.entity.RefundRequest;
import com.clinic.entity.User;
import com.clinic.entity.UserRole;
import com.clinic.exception.BadRequestException;
import com.clinic.repository.RefundRequestRepository;
import com.clinic.security.CurrentUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Refund approval controls: the amount threshold and separation of duties.
 */
@ExtendWith(MockitoExtension.class)
class RefundServiceImplTest {

    private static final BigDecimal THRESHOLD = new BigDecimal("500.00");

    @Mock private RefundRequestRepository refundRequestRepository;
    @Mock private CurrentUser currentUser;
    @Mock private PasswordEncoder passwordEncoder;

    private RefundServiceImpl refundService;

    @BeforeEach
    void setUp() {
        refundService = new RefundServiceImpl(refundRequestRepository, currentUser);
        ReflectionTestUtils.setField(refundService, "approvalThreshold", THRESHOLD);
    }

    @Test
    void smallRefundIsSelfApproved() {
        stubCaller("cashier-1", UserRole.CASHIER);
        when(refundRequestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        RefundRequestResponse response = refundService.requestRefund(
                "invoice-1", new BigDecimal("50.00"), "Patient overcharged");

        assertEquals("APPROVED", response.status());
        assertFalse(response.requiresApproval());
        assertEquals("cashier-1", response.approvedById());
    }

    @Test
    void refundAboveThresholdIsHeldForApproval() {
        stubCaller("cashier-1", UserRole.CASHIER);
        when(refundRequestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        RefundRequestResponse response = refundService.requestRefund(
                "invoice-2", new BigDecimal("900.00"), "Service not rendered");

        assertEquals("PENDING_APPROVAL", response.status());
        assertTrue(response.requiresApproval());
        // Nobody has approved it yet.
        assertNull(response.approvedById());
    }

    @Test
    void refundExactlyAtThresholdIsSelfApproved() {
        stubCaller("cashier-1", UserRole.CASHIER);
        when(refundRequestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        RefundRequestResponse response = refundService.requestRefund(
                "invoice-3", THRESHOLD, "At threshold");

        assertEquals("APPROVED", response.status());
        assertFalse(response.requiresApproval());
    }

    @Test
    void requesterCannotApproveTheirOwnRefund() {
        stubCaller("cashier-1", UserRole.CASHIER);
        RefundRequest pending = RefundRequest.builder()
                .id("refund-1")
                .invoiceId("invoice-1")
                .amount(new BigDecimal("900.00"))
                .requiresApproval(true)
                .status(RefundRequest.Status.PENDING_APPROVAL)
                .requestedById("cashier-1")
                .reason("Service not rendered")
                .build();
        when(refundRequestRepository.findById("refund-1")).thenReturn(Optional.of(pending));

        assertThrows(BadRequestException.class, () -> refundService.approve("refund-1", "ok"));
    }

    @Test
    void secondPrivilegedUserCanApprove() {
        stubCaller("admin-1", UserRole.ADMIN);
        RefundRequest pending = RefundRequest.builder()
                .id("refund-1")
                .invoiceId("invoice-1")
                .amount(new BigDecimal("900.00"))
                .requiresApproval(true)
                .status(RefundRequest.Status.PENDING_APPROVAL)
                .requestedById("cashier-1")
                .reason("Service not rendered")
                .build();
        when(refundRequestRepository.findById("refund-1")).thenReturn(Optional.of(pending));
        when(refundRequestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        RefundRequestResponse response = refundService.approve("refund-1", "Verified with billing");

        assertEquals("APPROVED", response.status());
        assertEquals("admin-1", response.approvedById());
        verify(refundRequestRepository).save(any());
    }

    @Test
    void alreadyDecidedRefundCannotBeDecidedAgain() {
        stubCaller("admin-1", UserRole.ADMIN);
        RefundRequest decided = RefundRequest.builder()
                .id("refund-2")
                .invoiceId("invoice-2")
                .amount(new BigDecimal("900.00"))
                .requiresApproval(true)
                .status(RefundRequest.Status.APPROVED)
                .requestedById("cashier-1")
                .reason("Service not rendered")
                .build();
        when(refundRequestRepository.findById("refund-2")).thenReturn(Optional.of(decided));

        assertThrows(BadRequestException.class, () -> refundService.reject("refund-2", "no"));
    }

    @Test
    void refundWithoutReasonIsRejected() {
        stubCaller("cashier-1", UserRole.CASHIER);

        assertThrows(BadRequestException.class,
                () -> refundService.requestRefund("invoice-1", new BigDecimal("10.00"), " "));
    }

    @Test
    void nonPositiveRefundIsRejected() {
        stubCaller("cashier-1", UserRole.CASHIER);

        assertThrows(BadRequestException.class,
                () -> refundService.requestRefund("invoice-1", BigDecimal.ZERO, "zero amount"));
    }

    @Test
    void listMapsPage() {
        when(refundRequestRepository.findAllByOrderByRequestedAtDesc(any()))
                .thenReturn(new PageImpl<>(java.util.List.of(RefundRequest.builder()
                        .id("refund-1")
                        .invoiceId("invoice-1")
                        .amount(new BigDecimal("10.00"))
                        .requiresApproval(false)
                        .status(RefundRequest.Status.APPROVED)
                        .reason("ok")
                        .build())));

        var page = refundService.list(null, PageRequest.of(0, 20));

        assertEquals(1, page.totalElements());
    }

    private void stubCaller(String userId, UserRole role) {
        User user = AdminUser.builder()
                .id(userId)
                .email(userId + "@example.com")
                .password("encoded")
                .fullName("Test " + role)
                .role(role)
                .active(true)
                .build();
        // Lenient: the validation-only tests reject before the actor is read.
        lenient().when(currentUser.userId()).thenReturn(userId);
        lenient().when(currentUser.require()).thenReturn(new com.clinic.security.CustomUserPrincipal(user));
    }
}