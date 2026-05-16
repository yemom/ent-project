-- V2__add_constraints_and_triggers.sql
-- Additional constraints, triggers, and audit functionality
-- Created: May 6, 2026

-- =====================================================
-- FUNCTION: Update updated_at timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS: Automatically update updated_at on changes
-- =====================================================

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for appointments table
CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for medical_records table
CREATE TRIGGER update_medical_records_updated_at
    BEFORE UPDATE ON medical_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTION: Validate appointment constraints
-- =====================================================

CREATE OR REPLACE FUNCTION validate_appointment()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure appointment_date is in the future for new SCHEDULED appointments
    IF NEW.status = 'SCHEDULED' AND NEW.appointment_date <= CURRENT_TIMESTAMP THEN
        RAISE EXCEPTION 'Appointment date must be in the future for SCHEDULED appointments';
    END IF;

    -- Ensure patient exists and is of type PATIENT
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.patient_id AND user_type = 'PATIENT') THEN
        RAISE EXCEPTION 'Invalid patient ID or patient does not exist';
    END IF;

    -- Ensure doctor exists and is of type DOCTOR
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.doctor_id AND user_type = 'DOCTOR') THEN
        RAISE EXCEPTION 'Invalid doctor ID or doctor does not exist';
    END IF;

    -- Ensure patient and doctor are active
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.patient_id AND active = TRUE) THEN
        RAISE EXCEPTION 'Patient is not active';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.doctor_id AND active = TRUE) THEN
        RAISE EXCEPTION 'Doctor is not active or not available';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for appointment validation
CREATE TRIGGER validate_appointment_before_insert_update
    BEFORE INSERT OR UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION validate_appointment();

-- =====================================================
-- FUNCTION: Validate medical record constraints
-- =====================================================

CREATE OR REPLACE FUNCTION validate_medical_record()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure patient exists and is of type PATIENT
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.patient_id AND user_type = 'PATIENT') THEN
        RAISE EXCEPTION 'Invalid patient ID or patient does not exist';
    END IF;

    -- Ensure doctor exists and is of type DOCTOR
    IF NEW.doctor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.doctor_id AND user_type = 'DOCTOR') THEN
        RAISE EXCEPTION 'Invalid doctor ID or doctor does not exist';
    END IF;

    -- Ensure record_date is not in the future
    IF NEW.record_date > CURRENT_DATE THEN
        RAISE EXCEPTION 'Record date cannot be in the future';
    END IF;

    -- Ensure follow_up_date is in the future if follow_up_required is TRUE
    IF NEW.follow_up_required AND (NEW.follow_up_date IS NULL OR NEW.follow_up_date <= CURRENT_DATE) THEN
        RAISE EXCEPTION 'Follow-up date must be in the future when follow-up is required';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for medical record validation
CREATE TRIGGER validate_medical_record_before_insert_update
    BEFORE INSERT OR UPDATE ON medical_records
    FOR EACH ROW
    EXECUTE FUNCTION validate_medical_record();

-- =====================================================
-- AUDIT LOGGING TABLE (Optional but recommended)
-- =====================================================

CREATE TABLE audit_logs (
    id varchar(36) PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    record_id varchar(36) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by varchar(36), -- User ID who made the change
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_operation CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE'))
);

-- Index for audit logs
CREATE INDEX idx_audit_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_changed_at ON audit_logs(changed_at);
CREATE INDEX idx_audit_changed_by ON audit_logs(changed_by);

COMMENT ON TABLE audit_logs IS 'Audit trail for tracking changes to critical tables';

-- =====================================================
-- MATERIALIZED VIEW: Doctor Appointment Statistics
-- =====================================================

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

-- Index for materialized view
CREATE INDEX idx_doctor_stats_id ON doctor_appointment_stats(id);

-- =====================================================
-- MATERIALIZED VIEW: Patient Medical History Summary
-- =====================================================

CREATE MATERIALIZED VIEW patient_medical_summary AS
SELECT
    p.id,
    p.full_name,
    p.email,
    p.phone,
    COUNT(DISTINCT a.id) AS total_appointments,
    COUNT(DISTINCT mr.id) AS total_medical_records,
    MAX(a.appointment_date) AS last_appointment_date,
    COUNT(DISTINCT CASE WHEN mr.follow_up_required = TRUE THEN mr.id END) AS pending_follow_ups
FROM users p
LEFT JOIN appointments a ON p.id = a.patient_id
LEFT JOIN medical_records mr ON p.id = mr.patient_id
WHERE p.user_type = 'PATIENT'
GROUP BY p.id, p.full_name, p.email, p.phone;

-- Index for materialized view
CREATE INDEX idx_patient_summary_id ON patient_medical_summary(id);

-- =====================================================
-- GRANT PRIVILEGES FOR AUDIT TABLE
-- =====================================================

GRANT SELECT, INSERT ON audit_logs TO clinic_user;
GRANT SELECT ON doctor_appointment_stats TO clinic_user;
GRANT SELECT ON patient_medical_summary TO clinic_user;
