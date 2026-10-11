-- Test schema mirroring db/migration (V1..V16) for the H2 in-memory database.
-- Kept in sync with the Flyway migrations; edit both together.

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
    pharmacy_location VARCHAR(100),
    branch_id VARCHAR(36),
    registration_number VARCHAR(30),
    checked_in_at TIMESTAMP,
    -- V21: Super Admin user management
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    deactivation_reason VARCHAR(500),
    deactivated_at TIMESTAMP,
    address VARCHAR(300),
    -- V22: Staff assignment and filtering
    department VARCHAR(100),
    ward VARCHAR(100)
);

CREATE INDEX idx_users_role_active ON users(role, active);
CREATE INDEX idx_users_branch ON users(branch_id);
CREATE INDEX idx_users_deleted ON users(deleted);
CREATE INDEX idx_users_department ON users(department);

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
    signed_at TIMESTAMP,
    signed_by_id VARCHAR(36),
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT fk_medical_record_patient FOREIGN KEY (patient_id) REFERENCES users (id),
    CONSTRAINT fk_medical_record_doctor FOREIGN KEY (doctor_id) REFERENCES users (id),
    CONSTRAINT fk_medical_record_appointment FOREIGN KEY (appointment_id) REFERENCES appointments (id)
);

CREATE TABLE medical_record_amendments (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL,
    deleted_at TIMESTAMP,
    medical_record_id VARCHAR(36) NOT NULL,
    amended_by_id VARCHAR(36),
    amended_by_name VARCHAR(100),
    reason VARCHAR(500) NOT NULL,
    previous_values TEXT,
    new_values TEXT,
    amended_at TIMESTAMP
);

CREATE TABLE medical_record_amendment_fields (
    amendment_id VARCHAR(36) NOT NULL,
    field_name VARCHAR(60) NOT NULL,
    PRIMARY KEY (amendment_id, field_name)
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

CREATE TABLE refresh_tokens (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL
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
    -- V20: critical-result flag. Defaults FALSE so historical results are unaffected.
    is_critical BOOLEAN NOT NULL DEFAULT FALSE,
    submitted_at TIMESTAMP
);

CREATE INDEX idx_lab_results_critical ON lab_results(is_critical, status);

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

CREATE TABLE notifications (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL,
    deleted_at TIMESTAMP,
    recipient_user_id VARCHAR(36),
    recipient_role VARCHAR(20),
    type VARCHAR(40) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    reference_id VARCHAR(36),
    link VARCHAR(255),
    read_at TIMESTAMP,
    CONSTRAINT check_notification_recipient CHECK (recipient_user_id IS NOT NULL OR recipient_role IS NOT NULL)
);

CREATE TABLE patient_assignments (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL,
    deleted_at TIMESTAMP,
    patient_id VARCHAR(36) NOT NULL REFERENCES users (id),
    doctor_id VARCHAR(36) NOT NULL REFERENCES users (id),
    -- V18: nurse scoping. Plain id (no FK) because users is a single-table
    -- hierarchy; validated against the user table in PatientServiceImpl.
    nurse_id VARCHAR(36),
    department_id VARCHAR(36),
    queue_position INTEGER,
    assigned_by_id VARCHAR(36),
    assigned_by_name VARCHAR(100),
    assigned_at TIMESTAMP NOT NULL,
    released_at TIMESTAMP,
    reason VARCHAR(500)
);

CREATE INDEX idx_patient_assignments_nurse ON patient_assignments(nurse_id, released_at);

CREATE TABLE audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL,
    deleted_at TIMESTAMP,
    actor_id VARCHAR(36),
    actor_email VARCHAR(100),
    actor_role VARCHAR(20),
    action VARCHAR(40) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(36),
    branch_id VARCHAR(36),
    reason VARCHAR(500),
    ip_address VARCHAR(64),
    metadata TEXT
);

CREATE TABLE role_change_requests (
    id VARCHAR(36) PRIMARY KEY,
    target_user_id VARCHAR(36) NOT NULL,
    target_user_email VARCHAR(100),
    previous_role VARCHAR(20) NOT NULL,
    target_role VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    requested_by_id VARCHAR(36) NOT NULL,
    requested_by_email VARCHAR(100),
    approved_by_id VARCHAR(36),
    approved_by_email VARCHAR(100),
    reason VARCHAR(500),
    decision_reason VARCHAR(500),
    requested_at TIMESTAMP NOT NULL,
    decided_at TIMESTAMP
);

CREATE TABLE refund_requests (
    id VARCHAR(36) PRIMARY KEY,
    invoice_id VARCHAR(36) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING_APPROVAL',
    requested_by_id VARCHAR(36) NOT NULL,
    requested_by_email VARCHAR(100),
    approved_by_id VARCHAR(36),
    approved_by_email VARCHAR(100),
    reason VARCHAR(500) NOT NULL,
    decision_reason VARCHAR(500),
    requested_at TIMESTAMP NOT NULL,
    decided_at TIMESTAMP
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

-- =====================================================
-- V17: hospital operations and billing (mirrors the migration)
-- =====================================================

CREATE TABLE departments (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    description VARCHAR(500),
    head_doctor_id VARCHAR(36),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_departments_active ON departments(active);
CREATE INDEX idx_departments_name ON departments(name);

CREATE TABLE wards (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    department_id VARCHAR(36) NOT NULL REFERENCES departments(id),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    floor VARCHAR(20),
    capacity INT NOT NULL DEFAULT 1,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT check_wards_capacity CHECK (capacity > 0)
);

CREATE INDEX idx_wards_department ON wards(department_id);
CREATE INDEX idx_wards_active ON wards(active);

CREATE TABLE rooms (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    ward_id VARCHAR(36) NOT NULL REFERENCES wards(id),
    name VARCHAR(100) NOT NULL,
    room_type VARCHAR(40) NOT NULL DEFAULT 'GENERAL',
    capacity INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
    CONSTRAINT check_rooms_capacity CHECK (capacity > 0),
    CONSTRAINT check_rooms_status CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE'))
);

CREATE INDEX idx_rooms_ward ON rooms(ward_id);
CREATE INDEX idx_rooms_status ON rooms(status);

CREATE TABLE admissions (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    patient_id VARCHAR(36) NOT NULL REFERENCES users(id),
    doctor_id VARCHAR(36) REFERENCES users(id),
    ward_id VARCHAR(36) REFERENCES wards(id),
    room_id VARCHAR(36) REFERENCES rooms(id),
    status VARCHAR(20) NOT NULL DEFAULT 'ADMITTED',
    admitted_at TIMESTAMP NOT NULL,
    discharged_at TIMESTAMP,
    diagnosis VARCHAR(500),
    notes TEXT,
    CONSTRAINT check_admissions_status CHECK (status IN ('ADMITTED', 'DISCHARGED', 'TRANSFERRED'))
);

CREATE INDEX idx_admissions_patient ON admissions(patient_id, status);
CREATE INDEX idx_admissions_status ON admissions(status, admitted_at DESC);
CREATE INDEX idx_admissions_ward ON admissions(ward_id);

CREATE TABLE invoices (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    invoice_number VARCHAR(40) NOT NULL UNIQUE,
    patient_id VARCHAR(36) NOT NULL REFERENCES users(id),
    appointment_id VARCHAR(36),
    status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    tax DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total DECIMAL(12, 2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0,
    issued_at TIMESTAMP NOT NULL,
    due_at TIMESTAMP,
    notes VARCHAR(500),
    CONSTRAINT check_invoices_status CHECK (status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID')),
    CONSTRAINT check_invoices_total CHECK (total >= 0),
    CONSTRAINT check_invoices_paid CHECK (amount_paid >= 0)
);

CREATE INDEX idx_invoices_patient ON invoices(patient_id, status);
CREATE INDEX idx_invoices_status ON invoices(status, issued_at DESC);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);

CREATE TABLE invoice_lines (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    invoice_id VARCHAR(36) NOT NULL REFERENCES invoices(id),
    description VARCHAR(200) NOT NULL,
    category VARCHAR(40) NOT NULL DEFAULT 'CONSULTATION',
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    CONSTRAINT check_invoice_lines_quantity CHECK (quantity > 0),
    CONSTRAINT check_invoice_lines_price CHECK (unit_price >= 0)
);

CREATE INDEX idx_invoice_lines_invoice ON invoice_lines(invoice_id);

CREATE TABLE payments (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    payment_ref VARCHAR(40) NOT NULL UNIQUE,
    invoice_id VARCHAR(36) NOT NULL REFERENCES invoices(id),
    amount DECIMAL(12, 2) NOT NULL,
    method VARCHAR(20) NOT NULL DEFAULT 'CASH',
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    received_by_id VARCHAR(36),
    received_at TIMESTAMP NOT NULL,
    notes VARCHAR(500),
    CONSTRAINT check_payments_amount CHECK (amount > 0),
    CONSTRAINT check_payments_method CHECK (method IN ('CASH', 'CARD', 'MOBILE', 'INSURANCE', 'BANK_TRANSFER')),
    CONSTRAINT check_payments_status CHECK (status IN ('COMPLETED', 'FAILED', 'REVERSED'))
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id, status);
CREATE INDEX idx_payments_received ON payments(received_at DESC);

CREATE TABLE receipts (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    receipt_number VARCHAR(40) NOT NULL UNIQUE,
    payment_id VARCHAR(36) NOT NULL REFERENCES payments(id),
    invoice_id VARCHAR(36) NOT NULL REFERENCES invoices(id),
    amount DECIMAL(12, 2) NOT NULL,
    issued_by_id VARCHAR(36),
    issued_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_receipts_payment ON receipts(payment_id);
CREATE INDEX idx_receipts_invoice ON receipts(invoice_id);

CREATE TABLE nurse_observations (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    patient_id VARCHAR(36) NOT NULL REFERENCES users(id),
    recorded_by_id VARCHAR(36) NOT NULL,
    recorded_by_name VARCHAR(100),
    kind VARCHAR(30) NOT NULL,
    blood_pressure VARCHAR(20),
    heart_rate INT,
    temperature_c DECIMAL(4, 1),
    respiratory_rate INT,
    oxygen_saturation DECIMAL(5, 2),
    weight_kg DECIMAL(6, 2),
    medication VARCHAR(200),
    dose VARCHAR(100),
    notes TEXT,
    observed_at TIMESTAMP NOT NULL,
    CONSTRAINT check_nurse_obs_kind CHECK (kind IN ('VITALS', 'NURSING_NOTE', 'MEDICATION_ADMINISTRATION'))
);

CREATE INDEX idx_nurse_obs_patient ON nurse_observations(patient_id, observed_at DESC);
CREATE INDEX idx_nurse_obs_kind ON nurse_observations(kind, observed_at DESC);
CREATE INDEX idx_nurse_obs_recorder ON nurse_observations(recorded_by_id);

-- =====================================================
-- V19: pharmacy inventory (mirrors the migration)
-- =====================================================

CREATE TABLE suppliers (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    name VARCHAR(150) NOT NULL,
    contact_name VARCHAR(120),
    email VARCHAR(150),
    phone VARCHAR(40),
    address VARCHAR(300),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_suppliers_active ON suppliers(active);

CREATE TABLE medicines (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(40) NOT NULL UNIQUE,
    category VARCHAR(60) NOT NULL DEFAULT 'GENERAL',
    form VARCHAR(60),
    strength VARCHAR(60),
    unit VARCHAR(30) NOT NULL DEFAULT 'unit',
    reorder_level DECIMAL(12, 2) NOT NULL DEFAULT 0,
    unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
    requires_prescription BOOLEAN NOT NULL DEFAULT TRUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT check_medicines_reorder CHECK (reorder_level >= 0),
    CONSTRAINT check_medicines_cost CHECK (unit_cost >= 0)
);

CREATE INDEX idx_medicines_name ON medicines(name);
CREATE INDEX idx_medicines_category ON medicines(category);
CREATE INDEX idx_medicines_active ON medicines(active);

CREATE TABLE stock_batches (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    medicine_id VARCHAR(36) NOT NULL REFERENCES medicines(id),
    supplier_id VARCHAR(36) REFERENCES suppliers(id),
    batch_number VARCHAR(60) NOT NULL,
    expiry_date DATE NOT NULL,
    quantity DECIMAL(12, 2) NOT NULL DEFAULT 0,
    unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
    received_at TIMESTAMP NOT NULL,
    notes VARCHAR(500),
    CONSTRAINT uk_stock_batches_batch UNIQUE (medicine_id, batch_number),
    CONSTRAINT check_stock_batches_quantity CHECK (quantity >= 0),
    CONSTRAINT check_stock_batches_cost CHECK (unit_cost >= 0)
);

CREATE INDEX idx_stock_batches_medicine ON stock_batches(medicine_id, expiry_date);
CREATE INDEX idx_stock_batches_expiry ON stock_batches(expiry_date);
CREATE INDEX idx_stock_batches_supplier ON stock_batches(supplier_id);

CREATE TABLE stock_movements (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    medicine_id VARCHAR(36) NOT NULL REFERENCES medicines(id),
    batch_id VARCHAR(36) REFERENCES stock_batches(id),
    kind VARCHAR(20) NOT NULL,
    quantity DECIMAL(12, 2) NOT NULL,
    balance_after DECIMAL(12, 2) NOT NULL,
    unit_cost DECIMAL(12, 2) NOT NULL DEFAULT 0,
    reference VARCHAR(120),
    reason VARCHAR(500),
    performed_by_id VARCHAR(36),
    performed_by_name VARCHAR(100),
    prescription_order_id VARCHAR(36),
    performed_at TIMESTAMP NOT NULL,
    CONSTRAINT check_stock_movements_kind CHECK (
        kind IN ('RECEIVED', 'DISPENSED', 'RETURNED', 'DAMAGED', 'EXPIRED', 'ADJUSTED')),
    CONSTRAINT check_stock_movements_quantity CHECK (quantity > 0),
    CONSTRAINT check_stock_movements_balance CHECK (balance_after >= 0)
);

CREATE INDEX idx_stock_movements_medicine ON stock_movements(medicine_id, performed_at DESC);
CREATE INDEX idx_stock_movements_batch ON stock_movements(batch_id);
CREATE INDEX idx_stock_movements_kind ON stock_movements(kind, performed_at DESC);
CREATE INDEX idx_stock_movements_performed_by ON stock_movements(performed_by_id);