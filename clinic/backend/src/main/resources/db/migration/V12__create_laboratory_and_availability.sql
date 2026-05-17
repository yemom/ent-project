-- V12: Create laboratory and doctor availability tables

CREATE TABLE laboratories (
    id varchar(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(500) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    operating_hours_start VARCHAR(10),
    operating_hours_end VARCHAR(10),
    equipment TEXT,
    capacity INT,
    description TEXT,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE doctor_availability (
    id varchar(36) PRIMARY KEY,
    doctor_id varchar(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    laboratory_id varchar(36) NOT NULL REFERENCES laboratories(id) ON DELETE CASCADE,
    day_of_week VARCHAR(10) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    max_patients INT,
    notes TEXT,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lab_name ON laboratories(name);
CREATE INDEX idx_lab_status ON laboratories(status);
CREATE INDEX idx_doctor_id_avail ON doctor_availability(doctor_id);
CREATE INDEX idx_lab_id_avail ON doctor_availability(laboratory_id);
CREATE INDEX idx_day_of_week ON doctor_availability(day_of_week);
