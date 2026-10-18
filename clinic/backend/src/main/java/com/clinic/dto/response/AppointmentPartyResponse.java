package com.clinic.dto.response;

import com.clinic.entity.UserRole;

/**
 * The patient or doctor on an appointment, as the front desk needs to see them.
 *
 * <p>A deliberate superset of {@link UserSummaryResponse}: every field that summary
 * carries is present here, plus the two identifiers a scheduler actually needs to
 * pick the right record out of a list — the patient's front-desk registration
 * number and the doctor's specialisation. Without them the reception list could
 * only show a display name, which is not enough to disambiguate two patients
 * registered under the same name.
 *
 * <p>Populated from the entity, never from the request: both ids come from the
 * persisted {@code Appointment} rows.
 */
public record AppointmentPartyResponse(
        String id,
        String fullName,
        String email,
        UserRole role,
        Boolean active,
        String registrationNumber,
        String specialization
) {
}