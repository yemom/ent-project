package com.clinic.service.impl;

import com.clinic.service.AsyncNotificationService;
import com.clinic.service.LabNotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class AsyncNotificationServiceImpl implements AsyncNotificationService {

    private final LabNotificationService labNotificationService;

    public AsyncNotificationServiceImpl(LabNotificationService labNotificationService) {
        this.labNotificationService = labNotificationService;
    }

    @Async("applicationTaskExecutor")
    @Override
    public void notifyLabResultReady(String doctorId, String labOrderId, String labResultId) {
        try {
            labNotificationService.create(doctorId, labOrderId, labResultId);
        } catch (Exception e) {
            log.error("Failed to create lab notification for labResultId={}", labResultId, e);
        }
    }
}
