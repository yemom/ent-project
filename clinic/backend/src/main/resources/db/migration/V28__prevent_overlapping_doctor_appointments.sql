-- Service-level availability checks are not sufficient when two transactions
-- book the same doctor and slot concurrently. PostgreSQL must arbitrate the
-- invariant at the database boundary.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Clean up any historical overlapping appointments prior to enforcing the exclusion constraint.
-- Mark the newer/later conflicting records as CANCELLED so historical data satisfies the constraint.
WITH ranked_conflicts AS (
    SELECT a1.id
    FROM appointments a1
    JOIN appointments a2 ON a1.doctor_id = a2.doctor_id AND a1.id <> a2.id
    WHERE a1.status IN ('SCHEDULED', 'CONFIRMED', 'COMPLETED')
      AND a2.status IN ('SCHEDULED', 'CONFIRMED', 'COMPLETED')
      AND tsrange(a1.appointment_date, a1.appointment_date + make_interval(mins => a1.duration), '[)') &&
          tsrange(a2.appointment_date, a2.appointment_date + make_interval(mins => a2.duration), '[)')
      AND (a1.created_at > a2.created_at OR (a1.created_at = a2.created_at AND a1.id > a2.id))
)
UPDATE appointments
SET status = 'CANCELLED',
    notes = COALESCE(notes, '') || ' [System cancelled due to historical slot conflict prior to V28 constraint]'
WHERE id IN (SELECT id FROM ranked_conflicts);

ALTER TABLE appointments
    DROP CONSTRAINT IF EXISTS appointments_doctor_slot_exclusion;

ALTER TABLE appointments
    ADD CONSTRAINT appointments_doctor_slot_exclusion
    EXCLUDE USING gist (
        doctor_id WITH =,
        tsrange(
            appointment_date,
            appointment_date + make_interval(mins => duration),
            '[)'
        ) WITH &&
    )
    WHERE (status IN ('SCHEDULED', 'CONFIRMED', 'COMPLETED'));
