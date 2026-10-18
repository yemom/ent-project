package com.clinic.service;

import java.time.LocalDate;

/**
 * Filters for a patient's own record listing.
 *
 * <p>Every field narrows the caller's own records and none of them can widen them:
 * the owning patient id is taken from the authenticated principal inside the
 * service, so there is deliberately no {@code patientId} on this record for a
 * caller to supply.
 *
 * @param fromDate inclusive lower bound on the record date, or null
 * @param toDate   inclusive upper bound on the record date, or null
 * @param keyword  matched against diagnosis, treatment, prescription and notes
 */
public record OwnRecordFilter(
        LocalDate fromDate,
        LocalDate toDate,
        String keyword
) {
    public OwnRecordFilter {
        // Normalise a blank keyword to null so the specification can use
        // `!= null` alone as the "filter is active" test.
        if (keyword != null && keyword.isBlank()) {
            keyword = null;
        }
        if (keyword != null) {
            keyword = keyword.trim();
        }
    }

    public static OwnRecordFilter of() {
        return new OwnRecordFilter(null, null, null);
    }
}