package com.clinic.service;

public interface AsyncNotificationService {

    void notifyLabResultReady(String doctorId, String labOrderId, String labResultId);
}
