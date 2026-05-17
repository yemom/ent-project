CREATE TABLE users (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL,
    deleted_at TIMESTAMP,
    user_type VARCHAR(31) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL,
    active BOOLEAN NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(10),
    medical_history TEXT,
    blood_type VARCHAR(5),
    allergies TEXT,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    specialization VARCHAR(100),
    license_number VARCHAR(50) UNIQUE,
    years_of_experience INTEGER,
    qualifications TEXT,
    consultation_fee DECIMAL(10, 2),
    bio TEXT,
    available BOOLEAN,
    employee_number VARCHAR(50) UNIQUE,
    pharmacy_location VARCHAR(100)
);

CREATE TABLE appointments (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL,
    deleted_at TIMESTAMP,
    patient_id VARCHAR(36) NOT NULL,
    doctor_id VARCHAR(36) NOT NULL,
    appointment_date TIMESTAMP NOT NULL,
    duration INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    reason_for_visit VARCHAR(500),
    notes TEXT,
    reminder_sent BOOLEAN NOT NULL,
    reminder_sent_at TIMESTAMP,
    cancelled_by VARCHAR(50),
    cancellation_reason TEXT,
    cancellation_date TIMESTAMP,
    CONSTRAINT fk_appointment_patient FOREIGN KEY (patient_id) REFERENCES users (id),
    CONSTRAINT fk_appointment_doctor FOREIGN KEY (doctor_id) REFERENCES users (id)
);

CREATE TABLE medical_records (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL,
    deleted_at TIMESTAMP,
    patient_id VARCHAR(36) NOT NULL,
    doctor_id VARCHAR(36) NOT NULL,
    appointment_id VARCHAR(36),
    diagnosis TEXT,
    treatment TEXT,
    prescription TEXT,
    test_results TEXT,
    vital_signs TEXT,
    follow_up_required BOOLEAN NOT NULL,
    follow_up_date DATE,
    notes TEXT,
    record_date DATE NOT NULL,
    medical_record_type VARCHAR(50),
    is_confidential BOOLEAN NOT NULL,
    CONSTRAINT fk_medical_record_patient FOREIGN KEY (patient_id) REFERENCES users (id),
    CONSTRAINT fk_medical_record_doctor FOREIGN KEY (doctor_id) REFERENCES users (id),
    CONSTRAINT fk_medical_record_appointment FOREIGN KEY (appointment_id) REFERENCES appointments (id)
);

CREATE TABLE token_blacklist (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL,
    deleted_at TIMESTAMP,
    token VARCHAR(2048) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    blacklisted_at TIMESTAMP NOT NULL
);

CREATE TABLE prescription_orders (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL,
    deleted_at TIMESTAMP,
    doctor_id VARCHAR(36) NOT NULL,
    doctor_name VARCHAR(100) NOT NULL,
    patient_name VARCHAR(100) NOT NULL,
    drug_name VARCHAR(200) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    instructions TEXT,
    status VARCHAR(20) NOT NULL,
    ordered_at TIMESTAMP NOT NULL,
    dispensed_at TIMESTAMP
);

CREATE TABLE lab_orders (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL,
    deleted_at TIMESTAMP,
    patient_id VARCHAR(36) NOT NULL,
    doctor_id VARCHAR(36) NOT NULL,
    appointment_id VARCHAR(36),
    urgency VARCHAR(20) NOT NULL,
    clinical_notes TEXT NOT NULL,
    status VARCHAR(20) NOT NULL
);

CREATE TABLE lab_order_tests (
    lab_order_id VARCHAR(36) NOT NULL,
    test_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (lab_order_id, test_name)
);

CREATE TABLE lab_results (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL,
    deleted_at TIMESTAMP,
    lab_order_id VARCHAR(36) NOT NULL,
    lab_technician_id VARCHAR(36) NOT NULL,
    findings TEXT NOT NULL,
    file_url VARCHAR(500),
    status VARCHAR(20) NOT NULL,
    submitted_at TIMESTAMP
);

CREATE TABLE lab_notifications (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL,
    deleted_at TIMESTAMP,
    user_id VARCHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    lab_order_id VARCHAR(36),
    lab_result_id VARCHAR(36),
    is_read BOOLEAN NOT NULL
);

CREATE TABLE laboratories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(500) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    status VARCHAR(20) NOT NULL,
    operating_hours_start VARCHAR(10),
    operating_hours_end VARCHAR(10),
    equipment TEXT,
    capacity INT,
    description TEXT,
    deleted BOOLEAN NOT NULL,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE TABLE doctor_availability (
    id VARCHAR(36) PRIMARY KEY,
    doctor_id VARCHAR(36) NOT NULL REFERENCES users(id),
    laboratory_id VARCHAR(36) NOT NULL REFERENCES laboratories(id),
    day_of_week VARCHAR(10) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN NOT NULL,
    max_patients INT,
    notes TEXT,
    deleted BOOLEAN NOT NULL,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);