-- V18: nurse scoping for patient assignments.
--
-- `patient_assignments` only linked a patient to a doctor, which left the NURSE
-- role with no panel and made observation writes impossible to authorise: a
-- nurse's user id never appears in doctor_id. This adds an optional nurse to the
-- same assignment row so one table defines "who is caring for this patient" for
-- both the doctor panel and the nursing panel.
--
-- Additive: the column is nullable, so existing rows keep working and a patient
-- can still be assigned to a doctor with no nurse attached.

ALTER TABLE patient_assignments
    ADD COLUMN IF NOT EXISTS nurse_id VARCHAR(36);

CREATE INDEX IF NOT EXISTS idx_patient_assignments_nurse
    ON patient_assignments(nurse_id, released_at);

-- Referential integrity is enforced in the service layer rather than by a FK:
-- users is a single-table hierarchy, so a plain id cannot be constrained here
-- without creating an inheritance-cycle constraint.