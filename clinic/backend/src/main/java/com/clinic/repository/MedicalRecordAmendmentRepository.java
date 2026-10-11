package com.clinic.repository;

import com.clinic.entity.MedicalRecordAmendment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MedicalRecordAmendmentRepository extends JpaRepository<MedicalRecordAmendment, String> {

    List<MedicalRecordAmendment> findByMedicalRecordIdOrderByCreatedAtDesc(String medicalRecordId);

    Page<MedicalRecordAmendment> findByMedicalRecordId(String medicalRecordId, Pageable pageable);

    long countByMedicalRecordId(String medicalRecordId);
}