package com.clinic.repository;

import com.clinic.entity.RoleChangeRequest;
import com.clinic.entity.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RoleChangeRequestRepository extends JpaRepository<RoleChangeRequest, String> {

    Page<RoleChangeRequest> findByStatusOrderByRequestedAtDesc(RoleChangeRequest.Status status, Pageable pageable);

    Page<RoleChangeRequest> findAllByOrderByRequestedAtDesc(Pageable pageable);

    Page<RoleChangeRequest> findByTargetUserIdOrderByRequestedAtDesc(String targetUserId, Pageable pageable);

    Optional<RoleChangeRequest> findFirstByTargetUserIdAndRequestedRoleAndStatus(
            String targetUserId, UserRole requestedRole, RoleChangeRequest.Status status);

    boolean existsByTargetUserIdAndRequestedRoleAndStatus(
            String targetUserId, UserRole requestedRole, RoleChangeRequest.Status status);
}