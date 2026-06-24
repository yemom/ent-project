package com.clinic.service.impl;

import com.clinic.dto.request.UpdateLabNotificationReadRequest;
import com.clinic.dto.response.LabNotificationResponse;
import com.clinic.entity.LabNotification;
import com.clinic.exception.ResourceNotFoundException;
import com.clinic.mapper.LabNotificationMapper;
import com.clinic.repository.LabNotificationRepository;
import com.clinic.service.LabNotificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import static com.clinic.config.CacheNames.LAB_NOTIFICATION_COUNTS;
import static com.clinic.config.CacheNames.LAB_NOTIFICATIONS;

@Service
@Transactional
@Slf4j
public class LabNotificationServiceImpl implements LabNotificationService {

    private final LabNotificationRepository labNotificationRepository;
    private final LabNotificationMapper mapper;

    public LabNotificationServiceImpl(LabNotificationRepository labNotificationRepository, LabNotificationMapper mapper) {
        this.labNotificationRepository = labNotificationRepository;
        this.mapper = mapper;
    }

    @Override
    @CacheEvict(cacheNames = {LAB_NOTIFICATIONS, LAB_NOTIFICATION_COUNTS}, allEntries = true)
    public LabNotificationResponse create(String userId, String labOrderId, String labResultId) {
        String message = String.format("Lab result for order %s is ready for review", labOrderId);
        LabNotification notification = mapper.toEntity(userId, labOrderId, labResultId, message);
        LabNotification saved = labNotificationRepository.save(notification);
        log.info("Created lab notification id={} userId={}", saved.getId(), userId);
        return mapper.toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = LAB_NOTIFICATIONS, key = "'id:' + #id")
    public LabNotificationResponse getById(String id) {
        return mapper.toResponse(getEntityById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LabNotificationResponse> getByUserId(String userId, Pageable pageable) {
        return labNotificationRepository.findByUserId(userId, pageable).map(mapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LabNotificationResponse> getUnreadByUserId(String userId, Pageable pageable) {
        return labNotificationRepository.findByUserIdAndIsReadFalse(userId, pageable).map(mapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    @Cacheable(cacheNames = LAB_NOTIFICATION_COUNTS, key = "'unread:' + #userId")
    public long getUnreadCountByUserId(String userId) {
        return labNotificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Override
    @CacheEvict(cacheNames = {LAB_NOTIFICATIONS, LAB_NOTIFICATION_COUNTS}, allEntries = true)
    public LabNotificationResponse markAsRead(String id, UpdateLabNotificationReadRequest request) {
        LabNotification notification = getEntityById(id);
        notification.setIsRead(request.isRead());
        LabNotification updated = labNotificationRepository.save(notification);
        log.info("Marked lab notification as {} id={}", request.isRead() ? "read" : "unread", id);
        return mapper.toResponse(updated);
    }

    @Override
    @CacheEvict(cacheNames = {LAB_NOTIFICATIONS, LAB_NOTIFICATION_COUNTS}, allEntries = true)
    public void delete(String id) {
        labNotificationRepository.deleteById(id);
        log.info("Deleted lab notification id={}", id);
    }

    private LabNotification getEntityById(String id) {
        return labNotificationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lab notification not found with id: " + id));
    }
}
