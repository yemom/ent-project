package com.clinic.service;

import com.clinic.dto.request.NurseObservationRequest;
import com.clinic.dto.response.NurseObservationResponse;
import com.clinic.dto.response.PageResponse;
import com.clinic.entity.NurseObservation;
import org.springframework.data.domain.Pageable;

/**
 * Nursing observations: vitals, nursing notes and medication administration.
 *
 * <p>Writes require {@code vital:write} or {@code medication:administer} — both
 * nurse permissions. A nurse cannot attach a diagnosis or a prescription here
 * because the entity has nowhere to store one.
 */
public interface NurseObservationService {

    PageResponse<NurseObservationResponse> list(String patientId, NurseObservation.Kind kind,
                                                 Pageable pageable);

    NurseObservationResponse record(NurseObservationRequest request);

    void delete(String id);
}