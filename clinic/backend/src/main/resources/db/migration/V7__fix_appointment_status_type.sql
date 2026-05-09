-- V7__fix_appointment_status_type.sql
-- Align appointments.status with Hibernate string binding and the test schema.
-- Created: 2026-05-09

DROP MATERIALIZED VIEW IF EXISTS doctor_appointment_stats CASCADE;
DROP VIEW IF EXISTS appointment_summaries CASCADE;

ALTER TABLE appointments
    ALTER COLUMN status TYPE VARCHAR(20) USING status::text;

ALTER TABLE appointments
    ADD CONSTRAINT check_appointment_status_values CHECK (
        status IN ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')
    );

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

CREATE MATERIALIZED VIEW doctor_appointment_stats AS
SELECT
    d.id,
    d.full_name,
    d.specialization,
    d.email,
    COUNT(a.id) AS total_appointments,
    SUM(CASE WHEN a.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_appointments,
    SUM(CASE WHEN a.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_appointments,
    SUM(CASE WHEN a.status = 'SCHEDULED' THEN 1 ELSE 0 END) AS scheduled_appointments,
    SUM(CASE WHEN a.status = 'NO_SHOW' THEN 1 ELSE 0 END) AS no_show_appointments,
    ROUND(AVG(CASE WHEN a.status = 'COMPLETED' THEN a.duration ELSE NULL END), 2) AS avg_appointment_duration,
    MAX(a.appointment_date) AS last_appointment_date
FROM users d
LEFT JOIN appointments a ON d.id = a.doctor_id
WHERE d.user_type = 'DOCTOR'
GROUP BY d.id, d.full_name, d.specialization, d.email;

CREATE INDEX idx_doctor_stats_id ON doctor_appointment_stats(id);
