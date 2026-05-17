-- V10: Create laboratory tables

DELETE FROM flyway_schema_history WHERE version = '9' AND description = 'create lab tables';

CREATE TABLE lab_orders (
    id varchar(36) PRIMARY KEY,
    patient_id varchar(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id varchar(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    appointment_id varchar(36) REFERENCES appointments(id) ON DELETE SET NULL,
    urgency VARCHAR(20) NOT NULL DEFAULT 'routine',
    clinical_notes TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lab_order_tests (
    lab_order_id varchar(36) NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
    test_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (lab_order_id, test_name)
);

CREATE TABLE lab_results (
    id varchar(36) PRIMARY KEY,
    lab_order_id varchar(36) NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
    lab_technician_id varchar(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    findings TEXT NOT NULL,
    file_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'DRAFT', 'FINAL')),
    submitted_at TIMESTAMP,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lab_notifications (
    id varchar(36) PRIMARY KEY,
    user_id varchar(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL DEFAULT 'lab_result_ready',
    message TEXT NOT NULL,
    lab_order_id varchar(36),
    lab_result_id varchar(36),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
