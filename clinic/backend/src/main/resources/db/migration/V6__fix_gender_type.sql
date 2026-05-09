-- V6__fix_gender_type.sql
-- Convert gender enum to VARCHAR and add a CHECK constraint
-- Created: 2026-05-08

-- Drop dependent views, alter type, then recreate views and add constraint
DROP VIEW IF EXISTS appointment_summaries CASCADE;
DROP VIEW IF EXISTS patients CASCADE;
DROP VIEW IF EXISTS doctors CASCADE;

ALTER TABLE users
    ALTER COLUMN gender TYPE VARCHAR(10) USING gender::text;

-- Recreate views (same as V1)
CREATE VIEW patients AS
SELECT * FROM users WHERE user_type = 'PATIENT';

CREATE VIEW doctors AS
SELECT * FROM users WHERE user_type = 'DOCTOR';

CREATE VIEW appointment_summaries AS
SELECT
    a.id,
    a.appointment_date,
    a.duration,
    a.status,
    p.full_name AS patient_name,
    p.email AS patient_email,
    d.full_name AS doctor_name,
    d.specialization AS doctor_specialization,
    a.created_at,
    a.updated_at
FROM appointments a
JOIN users p ON a.patient_id = p.id
JOIN users d ON a.doctor_id = d.id
WHERE p.user_type = 'PATIENT' AND d.user_type = 'DOCTOR';

ALTER TABLE users
    ADD CONSTRAINT check_gender_values CHECK (gender IN ('MALE', 'FEMALE', 'OTHER'));

-- Optional: drop the enum type if no longer used
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender') THEN
        DROP TYPE gender;
    END IF;
END$$;
