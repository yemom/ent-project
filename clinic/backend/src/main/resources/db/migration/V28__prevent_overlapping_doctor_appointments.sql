-- Service-level availability checks are not sufficient when two transactions
-- book the same doctor and slot concurrently. PostgreSQL must arbitrate the
-- invariant at the database boundary.
CREATE EXTENSION IF NOT EXISTS btree_gist;

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
