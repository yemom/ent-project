package com.clinic.service;

import com.clinic.dto.response.PageResponse;
import com.clinic.dto.response.RefundRequestResponse;
import com.clinic.entity.RefundRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;

public interface RefundService {

    /**
     * Records a refund request. Amounts at or below the configured threshold are
     * approved immediately; anything above is held for a second approver.
     */
    RefundRequestResponse requestRefund(String invoiceId, BigDecimal amount, String reason);

    RefundRequestResponse approve(String requestId, String decisionReason);

    RefundRequestResponse reject(String requestId, String decisionReason);

    PageResponse<RefundRequestResponse> list(RefundRequest.Status status, Pageable pageable);
}