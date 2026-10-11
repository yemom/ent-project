package com.clinic.service;

import com.clinic.dto.request.MedicalRecordAmendRequest;
import com.clinic.dto.request.MedicalRecordCreateRequest;
import com.clinic.dto.request.MedicalRecordSearchRequest;
import com.clinic.dto.request.MedicalRecordUpdateRequest;
import com.clinic.dto.response.MedicalRecordAmendmentResponse;
import com.clinic.dto.response.MedicalRecordResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface MedicalRecordService {

    MedicalRecordResponse create(MedicalRecordCreateRequest request);

    /** Plain update; kept for unsigned draft records. */
    MedicalRecordResponse update(String id, MedicalRecordUpdateRequest request);

    /**
     * Amends a record and records the previous values in an immutable amendment
     * row. Used for signed records, where a silent update is not allowed.
     */
    MedicalRecordResponse amend(String id, MedicalRecordAmendRequest request);

    MedicalRecordResponse getById(String id);

    Page<MedicalRecordResponse> getAll(Pageable pageable);

    Page<MedicalRecordResponse> search(MedicalRecordSearchRequest request, Pageable pageable);

    List<MedicalRecordAmendmentResponse> amendmentHistory(String medicalRecordId);

    /** Marks a record signed; after this only amendments are possible. */
    MedicalRecordResponse sign(String id);

    void delete(String id);
}