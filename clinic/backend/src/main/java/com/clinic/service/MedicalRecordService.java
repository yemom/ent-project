package com.clinic.service;

import com.clinic.dto.request.MedicalRecordAmendRequest;
import com.clinic.dto.request.MedicalRecordCreateRequest;
import com.clinic.dto.request.MedicalRecordSearchRequest;
import com.clinic.dto.request.MedicalRecordUpdateRequest;
import com.clinic.dto.response.MedicalRecordAmendmentResponse;
import com.clinic.dto.response.MedicalRecordResponse;
import com.clinic.dto.response.MyMedicalRecordResponse;
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

    /**
     * Reads a record on behalf of whoever is calling, applying the ownership rule.
     *
     * <p>A patient may read only their own record; a clinician with a read
     * permission is governed by the existing assignment checks. Callers that cannot
     * see the record get 403 rather than 404, because the id is theirs to know but
     * not to open.
     *
     * @see #getById(String)
     */
    MedicalRecordResponse getByIdForCaller(String id);

    Page<MedicalRecordResponse> getAll(Pageable pageable);

    /**
     * The caller's own records.
     *
     * <p>The patient is resolved from the authenticated principal, never from a
     * request parameter, so there is no way to widen the result set by editing a
     * query string. Optional filters apply <em>within</em> the caller's own
     * records and can never escape them.
     *
     * @param filter date range and keyword, all optional and all intersected with ownership
     */
    Page<MyMedicalRecordResponse> getOwnRecords(OwnRecordFilter filter, Pageable pageable);

    Page<MedicalRecordResponse> search(MedicalRecordSearchRequest request, Pageable pageable);

    List<MedicalRecordAmendmentResponse> amendmentHistory(String medicalRecordId);

    /** Marks a record signed; after this only amendments are possible. */
    MedicalRecordResponse sign(String id);

    void delete(String id);
}