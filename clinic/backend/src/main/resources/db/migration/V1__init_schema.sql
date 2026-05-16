-- V1__init_schema.sql
-- Initial database schema for clinic - Clinic Appointment & Medical Records Management System
-- Created: May 6, 2026

-- =====================================================
-- ENUM TYPES (for PostgreSQL)
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('ADMIN', 'DOCTOR', 'PATIENT');
CREATE TYPE gender AS ENUM ('MALE', 'FEMALE', 'OTHER');
CREATE TYPE appointment_status AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE medical_record_type AS ENUM ('CONSULTATION', 'SURGERY', 'LAB_TEST', 'VACCINATION', 'PRESCRIPTION', 'NOTES');

-- =====================================================
-- SEQUENCE FOR UUID GENERATION (Optional, but good for ordering)
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS users_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS appointments_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS medical_records_id_seq START 1;

-- =====================================================
-- USERS TABLE (Single Table Inheritance)
-- =====================================================

CREATE TABLE users (
    id varchar(36) PRIMARY KEY,
    user_type VARCHAR(20) NOT NULL DEFAULT 'PATIENT', -- Discriminator column

    -- Common fields for all users
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Patient-specific fields
    date_of_birth DATE,
    gender gender,
    medical_history TEXT,
    blood_type VARCHAR(5),
    allergies TEXT,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),

    -- Doctor-specific fields
    specialization VARCHAR(100),
    license_number VARCHAR(50) UNIQUE,
    years_of_experience INTEGER,
    qualifications TEXT,
    consultation_fee DECIMAL(10, 2),
    bio TEXT,
    available BOOLEAN DEFAULT TRUE,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT check_patient_type CHECK (user_type IN ('PATIENT', 'DOCTOR', 'ADMIN')),
    CONSTRAINT check_active CHECK (active IN (TRUE, FALSE))
);

-- Indexes for users table
CREATE INDEX idx_email ON users(email);
CREATE INDEX idx_phone ON users(phone);
CREATE INDEX idx_user_type ON users(user_type);
CREATE INDEX idx_role ON users(role);
CREATE INDEX idx_license_number ON users(license_number) WHERE license_number IS NOT NULL;
CREATE INDEX idx_active ON users(active);

-- =====================================================
-- APPOINTMENTS TABLE
-- =====================================================

CREATE TABLE appointments (
    id varchar(36) PRIMARY KEY,

    -- Foreign Keys
    patient_id varchar(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id varchar(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    -- Appointment details
    appointment_date TIMESTAMP NOT NULL,
    duration INTEGER NOT NULL, -- in minutes
    status appointment_status NOT NULL DEFAULT 'SCHEDULED',
    reason_for_visit VARCHAR(500),
    notes TEXT,

    -- Reminder & Notification
    reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_sent_at TIMESTAMP,

    -- Cancellation info
    cancelled_by VARCHAR(50),
    cancellation_reason TEXT,
    cancellation_date TIMESTAMP,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT check_duration CHECK (duration > 0),
    CONSTRAINT check_reminder_sent CHECK (reminder_sent IN (TRUE, FALSE))
);

-- Indexes for appointments table
CREATE INDEX idx_patient_id ON appointments(patient_id);
CREATE INDEX idx_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointment_date ON appointments(appointment_date);
CREATE INDEX idx_status ON appointments(status);
CREATE INDEX idx_appointment_patient_doctor ON appointments(patient_id, doctor_id);
CREATE INDEX idx_appointment_date_status ON appointments(appointment_date, status);

-- =====================================================
-- MEDICAL_RECORDS TABLE
-- =====================================================

CREATE TABLE medical_records (
    id varchar(36) PRIMARY KEY,

    -- Foreign Keys
    patient_id varchar(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id varchar(36) NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    appointment_id varchar(36) REFERENCES appointments(id) ON DELETE SET NULL,

    -- Medical information
    diagnosis TEXT,
    treatment TEXT,
    prescription TEXT,
    test_results TEXT,
    vital_signs TEXT, -- e.g., "BP: 120/80, HR: 72, Temp: 98.6F"

    -- Follow-up information
    follow_up_required BOOLEAN NOT NULL DEFAULT FALSE,
    follow_up_date DATE,

    -- Additional information
    notes TEXT,
    record_date DATE NOT NULL,
    medical_record_type VARCHAR(50),
    is_confidential BOOLEAN NOT NULL DEFAULT FALSE,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT check_follow_up CHECK (follow_up_required IN (TRUE, FALSE)),
    CONSTRAINT check_confidential CHECK (is_confidential IN (TRUE, FALSE))
);

-- Indexes for medical_records table
CREATE INDEX idx_patient_id_mr ON medical_records(patient_id);
CREATE INDEX idx_doctor_id_mr ON medical_records(doctor_id);
CREATE INDEX idx_appointment_id_mr ON medical_records(appointment_id);
CREATE INDEX idx_record_date ON medical_records(record_date);
CREATE INDEX idx_patient_record_date ON medical_records(patient_id, record_date);
CREATE INDEX idx_confidential ON medical_records(is_confidential);

-- =====================================================
-- VIEWS FOR CONVENIENCE QUERIES
-- =====================================================

-- View for all patients (filtered from users table)
CREATE VIEW patients AS
SELECT * FROM users WHERE user_type = 'PATIENT';

-- View for all doctors (filtered from users table)
CREATE VIEW doctors AS
SELECT * FROM users WHERE user_type = 'DOCTOR';

-- View for appointment summaries
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

-- =====================================================
-- COMMENTS (Documentation)
-- =====================================================

COMMENT ON TABLE users IS 'Central user table with single table inheritance for ADMIN, DOCTOR, and PATIENT roles';
COMMENT ON TABLE appointments IS 'Stores appointment records between patients and doctors';
COMMENT ON TABLE medical_records IS 'Stores medical records and treatment history for patients';

COMMENT ON COLUMN users.user_type IS 'Discriminator column for single table inheritance: PATIENT, DOCTOR, ADMIN';
COMMENT ON COLUMN appointments.duration IS 'Appointment duration in minutes';
COMMENT ON COLUMN medical_records.vital_signs IS 'Free-text field for vital signs like BP, HR, Temperature, etc.';
COMMENT ON COLUMN medical_records.is_confidential IS 'Flag to indicate if the record contains confidential information';

-- =====================================================
-- INITIAL DATA (Optional - for testing)
-- =====================================================

-- Create default ADMIN user (password should be hashed in production)
INSERT INTO users (
    id, user_type, email, password, full_name, phone, role, active, created_at, updated_at
) VALUES (
    '550e8400-e29b-41d4-a716-446655440000',
    'ADMIN',
    'admin@clinice.com',
    '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lm', -- password: "admin123"
    'System Administrator',
    '+1234567890',
    'ADMIN',
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- PRIVILEGES (For multi-user database)
-- =====================================================

-- Grant appropriate privileges to application user
-- Note: Adjust 'clinic_user' to match your actual database user
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO clinic_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON appointments TO clinic_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON medical_records TO clinic_user;
GRANT SELECT ON appointment_summaries TO clinic_user;
GRANT SELECT ON patients TO clinic_user;
GRANT SELECT ON doctors TO clinic_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO clinic_user;
