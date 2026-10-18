package com.clinic.dto.response;

import java.time.LocalDate;

/**
 * One of the signed-in patient's own records.
 *
 * <p>A deliberate subset of {@link MedicalRecordResponse}. The patient's chart is
 * theirs to read, but the clinician view also carries record-keeping internals —
 * the confidentiality flag, the authoring clinician, the amendment state — that are
 * there for clinical governance and are not part of what a patient is shown.
 *
 * <p>Returning a narrower type rather than filtering the wider one at the controller
 * is what makes the omission checkable: a field cannot leak here because it does
 * not exist on this record.
 *
 * @param doctorName    the clinician who wrote the record, for display
 * @param signed        whether the record has been signed off. Expressed as a flag
 *                      rather than the timestamp because the instant is not the
 *                      patient's to interpret.
 */
public record MyMedicalRecordResponse(
        String id,
        LocalDate recordDate,
        String medicalRecordType,
        String diagnosis,
        String treatment,
        String prescription,
        String testResults,
        Boolean followUpRequired,
        LocalDate followUpDate,
        String notes,
        String doctorName,
        boolean signed
) {
}