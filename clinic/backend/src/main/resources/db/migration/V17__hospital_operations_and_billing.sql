-- V17: Hospital operations and billing.
--
-- Adds the entities the dashboards previously had to fake: departments, wards,
-- rooms, admissions, invoices/payments/receipts, and nurse observations.
-- Additive only — nothing existing is dropped or retyped.

-- Drop any tables left in a partial/broken state from a prior failed run of this
-- migration. Detect by checking for columns that should exist but don't.
-- Tables are dropped in reverse-dependency order so FK constraints are satisfied.
DO $$
BEGIN
    -- Check if departments was created without 'name' (partial state)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'departments' AND column_name = 'name') THEN
        DROP TABLE IF EXISTS nurse_observations CASCADE;
        DROP TABLE IF EXISTS receipts           CASCADE;
        DROP TABLE IF EXISTS payments           CASCADE;
        DROP TABLE IF EXISTS invoice_lines      CASCADE;
        DROP TABLE IF EXISTS invoices           CASCADE;
        DROP TABLE IF EXISTS admissions         CASCADE;
        DROP TABLE IF EXISTS rooms              CASCADE;
        DROP TABLE IF EXISTS wards              CASCADE;
        DROP TABLE IF EXISTS departments        CASCADE;
    END IF;

    -- Check if invoices was created without 'invoice_number' (partial state)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'invoices' AND column_name = 'invoice_number') THEN
        DROP TABLE IF EXISTS nurse_observations CASCADE;
        DROP TABLE IF EXISTS receipts           CASCADE;
        DROP TABLE IF EXISTS payments           CASCADE;
        DROP TABLE IF EXISTS invoice_lines      CASCADE;
        DROP TABLE IF EXISTS invoices           CASCADE;
    END IF;
END $$;

-- =====================================================
-- 1. DEPARTMENTS / WARDS / ROOMS / ADMISSIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS departments (
    id           VARCHAR(36)  PRIMARY KEY,
    created_at   TIMESTAMP    NOT NULL,
    updated_at   TIMESTAMP    NOT NULL,
    deleted      BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at   TIMESTAMP,
    name         VARCHAR(100) NOT NULL,
    code         VARCHAR(20)  NOT NULL,
    description  VARCHAR(500),
    head_doctor_id VARCHAR(36),
    active       BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_departments_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_departments_active ON departments(active);
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);

CREATE TABLE IF NOT EXISTS wards (
    id            VARCHAR(36)  PRIMARY KEY,
    created_at    TIMESTAMP    NOT NULL,
    updated_at    TIMESTAMP    NOT NULL,
    deleted       BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at    TIMESTAMP,
    department_id VARCHAR(36)  NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    code          VARCHAR(20)  NOT NULL,
    floor         VARCHAR(20),
    capacity      INTEGER      NOT NULL DEFAULT 1,
    active        BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_wards_code UNIQUE (code),
    CONSTRAINT check_wards_capacity CHECK (capacity > 0)
);

CREATE INDEX IF NOT EXISTS idx_wards_department ON wards(department_id);
CREATE INDEX IF NOT EXISTS idx_wards_active ON wards(active);

CREATE TABLE IF NOT EXISTS rooms (
    id         VARCHAR(36)  PRIMARY KEY,
    created_at TIMESTAMP    NOT NULL,
    updated_at TIMESTAMP    NOT NULL,
    deleted    BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP,
    ward_id    VARCHAR(36)  NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
    name       VARCHAR(100) NOT NULL,
    room_type  VARCHAR(40)  NOT NULL DEFAULT 'GENERAL',
    capacity   INTEGER      NOT NULL DEFAULT 1,
    status     VARCHAR(20)  NOT NULL DEFAULT 'AVAILABLE',
    CONSTRAINT check_rooms_capacity CHECK (capacity > 0),
    CONSTRAINT check_rooms_status CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE'))
);

CREATE INDEX IF NOT EXISTS idx_rooms_ward ON rooms(ward_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

CREATE TABLE IF NOT EXISTS admissions (
    id            VARCHAR(36)  PRIMARY KEY,
    created_at    TIMESTAMP    NOT NULL,
    updated_at    TIMESTAMP    NOT NULL,
    deleted       BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at    TIMESTAMP,
    patient_id    VARCHAR(36)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id     VARCHAR(36)  REFERENCES users(id) ON DELETE SET NULL,
    ward_id       VARCHAR(36)  REFERENCES wards(id) ON DELETE SET NULL,
    room_id       VARCHAR(36)  REFERENCES rooms(id) ON DELETE SET NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'ADMITTED',
    admitted_at   TIMESTAMP    NOT NULL,
    discharged_at TIMESTAMP,
    diagnosis     VARCHAR(500),
    notes         TEXT,
    CONSTRAINT check_admissions_status CHECK (status IN ('ADMITTED', 'DISCHARGED', 'TRANSFERRED'))
);

CREATE INDEX IF NOT EXISTS idx_admissions_patient ON admissions(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status, admitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_admissions_ward ON admissions(ward_id);

-- =====================================================
-- 2. BILLING: INVOICES / LINES / PAYMENTS / RECEIPTS
-- =====================================================
CREATE TABLE IF NOT EXISTS invoices (
    id             VARCHAR(36)   PRIMARY KEY,
    created_at     TIMESTAMP     NOT NULL,
    updated_at     TIMESTAMP     NOT NULL,
    deleted        BOOLEAN       NOT NULL DEFAULT FALSE,
    deleted_at     TIMESTAMP,
    invoice_number VARCHAR(40)   NOT NULL,
    patient_id     VARCHAR(36)   NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    appointment_id VARCHAR(36)   REFERENCES appointments(id) ON DELETE SET NULL,
    status         VARCHAR(20)   NOT NULL DEFAULT 'ISSUED',
    subtotal       DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount       DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax            DECIMAL(12,2) NOT NULL DEFAULT 0,
    total          DECIMAL(12,2) NOT NULL DEFAULT 0,
    amount_paid    DECIMAL(12,2) NOT NULL DEFAULT 0,
    issued_at      TIMESTAMP     NOT NULL,
    due_at         TIMESTAMP,
    notes          VARCHAR(500),
    CONSTRAINT uk_invoices_number UNIQUE (invoice_number),
    CONSTRAINT check_invoices_status CHECK (status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID')),
    CONSTRAINT check_invoices_total CHECK (total >= 0),
    CONSTRAINT check_invoices_paid CHECK (amount_paid >= 0)
);

CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

CREATE TABLE IF NOT EXISTS invoice_lines (
    id          VARCHAR(36)   PRIMARY KEY,
    invoice_id  VARCHAR(36)   NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description VARCHAR(200)  NOT NULL,
    category    VARCHAR(40)   NOT NULL DEFAULT 'CONSULTATION',
    quantity    INTEGER       NOT NULL DEFAULT 1,
    unit_price  DECIMAL(12,2) NOT NULL,
    amount      DECIMAL(12,2) NOT NULL,
    CONSTRAINT check_invoice_lines_quantity CHECK (quantity > 0),
    CONSTRAINT check_invoice_lines_price CHECK (unit_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);

-- Drop stale payments table (and its dependent receipts) if invoice_id column is missing.
-- This handles partial/failed runs that left the table incomplete.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'payments' AND column_name = 'invoice_id') THEN
        DROP TABLE IF EXISTS receipts CASCADE;
        DROP TABLE IF EXISTS payments CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS payments (
    id             VARCHAR(36)   PRIMARY KEY,
    created_at     TIMESTAMP     NOT NULL,
    updated_at     TIMESTAMP     NOT NULL,
    deleted        BOOLEAN       NOT NULL DEFAULT FALSE,
    deleted_at     TIMESTAMP,
    payment_ref    VARCHAR(40)   NOT NULL,
    invoice_id     VARCHAR(36)   NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    amount         DECIMAL(12,2) NOT NULL,
    method         VARCHAR(20)   NOT NULL DEFAULT 'CASH',
    status         VARCHAR(20)   NOT NULL DEFAULT 'COMPLETED',
    received_by_id VARCHAR(36),
    received_at    TIMESTAMP     NOT NULL,
    notes          VARCHAR(500),
    CONSTRAINT uk_payments_ref UNIQUE (payment_ref),
    CONSTRAINT check_payments_amount CHECK (amount > 0),
    CONSTRAINT check_payments_method CHECK (method IN ('CASH', 'CARD', 'MOBILE', 'INSURANCE', 'BANK_TRANSFER')),
    CONSTRAINT check_payments_status CHECK (status IN ('COMPLETED', 'FAILED', 'REVERSED'))
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_received ON payments(received_at DESC);

CREATE TABLE IF NOT EXISTS receipts (
    id            VARCHAR(36)  PRIMARY KEY,
    created_at    TIMESTAMP    NOT NULL,
    updated_at    TIMESTAMP    NOT NULL,
    deleted       BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at    TIMESTAMP,
    receipt_number VARCHAR(40) NOT NULL,
    payment_id    VARCHAR(36)  NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    invoice_id    VARCHAR(36)  NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    amount        DECIMAL(12,2) NOT NULL,
    issued_by_id  VARCHAR(36),
    issued_at     TIMESTAMP    NOT NULL,
    CONSTRAINT uk_receipts_number UNIQUE (receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_receipts_payment ON receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_invoice ON receipts(invoice_id);

-- =====================================================
-- 3. NURSE OBSERVATIONS (vitals, nursing notes, medication administration)
-- =====================================================
CREATE TABLE IF NOT EXISTS nurse_observations (
    id            VARCHAR(36)  PRIMARY KEY,
    created_at    TIMESTAMP    NOT NULL,
    updated_at    TIMESTAMP    NOT NULL,
    deleted       BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at    TIMESTAMP,
    patient_id    VARCHAR(36)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recorded_by_id VARCHAR(36) NOT NULL,
    recorded_by_name VARCHAR(100),
    kind          VARCHAR(30)  NOT NULL,
    blood_pressure VARCHAR(20),
    heart_rate    INTEGER,
    temperature_c NUMERIC(4,1),
    respiratory_rate INTEGER,
    oxygen_saturation NUMERIC(5,2),
    weight_kg     NUMERIC(6,2),
    medication    VARCHAR(200),
    dose          VARCHAR(100),
    notes         TEXT,
    observed_at   TIMESTAMP    NOT NULL,
    CONSTRAINT check_nurse_obs_kind CHECK (kind IN ('VITALS', 'NURSING_NOTE', 'MEDICATION_ADMINISTRATION'))
);

CREATE INDEX IF NOT EXISTS idx_nurse_obs_patient ON nurse_observations(patient_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_nurse_obs_kind ON nurse_observations(kind, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_nurse_obs_recorder ON nurse_observations(recorded_by_id);