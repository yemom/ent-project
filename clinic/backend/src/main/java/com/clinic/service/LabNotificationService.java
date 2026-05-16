package com.clinic.service;

import com.clinic.dto.request.UpdateLabNotificationReadRequest;
import com.clinic.dto.response.LabNotificationResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface LabNotificationService {

    LabNotificationResponse create(String userId, String labOrderId, String labResultId);

    LabNotificationResponse getById(String id);

    Page<LabNotificationResponse> getByUserId(String userId, Pageable pageable);

    List<LabNotificationResponse> getUnreadByUserId(String userId);

    long getUnreadCountByUserId(String userId);

    LabNotificationResponse markAsRead(String id, UpdateLabNotificationReadRequest request);

    void delete(String id);
}
