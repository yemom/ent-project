package com.clinic.repository;

import com.clinic.entity.LabNotification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LabNotificationRepository extends JpaRepository<LabNotification, String>, JpaSpecificationExecutor<LabNotification> {
    Page<LabNotification> findByUserId(String userId, Pageable pageable);

    List<LabNotification> findByUserIdAndIsReadFalse(String userId);

    Page<LabNotification> findByUserIdAndIsReadFalse(String userId, Pageable pageable);

    long countByUserIdAndIsReadFalse(String userId);
}
