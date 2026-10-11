-- V16: Roles, notifications, front-desk assignment, and RBAC/security tables.
--
-- Additive only: no existing column or table is dropped or retyped, so this can
-- be applied to a live database without downtime. The matching H2 script lives in
-- src/test/resources/schema.sql.

-- =====================================================
-- 1. ROLES
-- =====================================================
-- Widen the CHECK constraints to the full clinic role set. ADMIN and LABORATORY
-- are retained because existing rows still carry them; the application maps them
-- onto SUPER_ADMIN and LAB_TECHNICIAN at runtime.
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_role_values;
ALTER TABLE users
    ADD CONSTRAINT check_role_values CHECK (role IN (
        'SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ADMIN',
        'DOCTOR', 'NURSE', 'RECEPTIONIST',
        'LAB_TECHNICIAN', 'LABORATORY',
        'PHARMACIST', 'CASHIER', 'PATIENT'
    ));

ALTER TABLE users DROP CONSTRAINT IF EXISTS check_user_type;
ALTER TABLE users
    ADD CONSTRAINT check_user_type CHECK (user_type IN (
        'PATIENT', 'DOCTOR', 'ADMIN', 'PHARMACIST', 'LABORATORY'
    ));

-- =====================================================
-- 2. NOTIFICATIONS (generalised from lab_notifications)
-- =====================================================
CREATE TABLE IF NOT EXISTS notifications (
    id                VARCHAR(36)  PRIMARY KEY,
    created_at        TIMESTAMP    NOT NULL,
    updated_at        TIMESTAMP    NOT NULL,
    deleted           BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMP,
    recipient_user_id VARCHAR(36),
    recipient_role    VARCHAR(20),
    type              VARCHAR(40)  NOT NULL,
    title             VARCHAR(200) NOT NULL,
    message           TEXT         NOT NULL,
    reference_id      VARCHAR(36),
    link              VARCHAR(255),
    read_at           TIMESTAMP,
    CONSTRAINT check_notification_recipient CHECK (recipient_user_id IS NOT NULL OR recipient_role IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
    ON notifications(recipient_user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_role_read
    ON notifications(recipient_role, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type_ref
    ON notifications(type, reference_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created
    ON notifications(created_at DESC);

-- =====================================================
-- 3. FRONT DESK: patient registration + assignment
-- =====================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id VARCHAR(36);
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_number VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_branch_role ON users(branch_id, role);
CREATE INDEX IF NOT EXISTS idx_users_registration_number ON users(registration_number);

CREATE TABLE IF NOT EXISTS patient_assignments (
    id              VARCHAR(36)   PRIMARY KEY,
    created_at      TIMESTAMP     NOT NULL,
    updated_at      TIMESTAMP     NOT NULL,
    deleted         BOOLEAN       NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    patient_id      VARCHAR(36)   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id       VARCHAR(36)   NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    department_id   VARCHAR(36),
    queue_position  INTEGER,
    assigned_by_id  VARCHAR(36),
    assigned_by_name VARCHAR(100),
    assigned_at     TIMESTAMP     NOT NULL,
    released_at     TIMESTAMP,
    reason          VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS idx_patient_assignments_patient
    ON patient_assignments(patient_id, released_at);
CREATE INDEX IF NOT EXISTS idx_patient_assignments_doctor
    ON patient_assignments(doctor_id, released_at);
CREATE INDEX IF NOT EXISTS idx_patient_assignments_department
    ON patient_assignments(department_id, released_at);

-- =====================================================
-- 4. IMMUTABLE MEDICAL RECORD AMENDMENTS
-- =====================================================
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS signed_by_id VARCHAR(36);
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS medical_record_amendments (
    id                 VARCHAR(36)  PRIMARY KEY,
    created_at         TIMESTAMP    NOT NULL,
    updated_at         TIMESTAMP    NOT NULL,
    deleted            BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at         TIMESTAMP,
    medical_record_id  VARCHAR(36)  NOT NULL,
    amended_by_id      VARCHAR(36),
    amended_by_name    VARCHAR(100),
    reason             VARCHAR(500) NOT NULL,
    previous_values    TEXT,
    new_values         TEXT,
    amended_at         TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mr_amendments_record
    ON medical_record_amendments(medical_record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mr_amendments_author
    ON medical_record_amendments(amended_by_id);

CREATE TABLE IF NOT EXISTS medical_record_amendment_fields (
    amendment_id VARCHAR(36) NOT NULL,
    field_name   VARCHAR(60) NOT NULL,
    PRIMARY KEY (amendment_id, field_name)
);

-- =====================================================
-- 5. IMMUTABLE AUDIT LOG (append-only)
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id          VARCHAR(36)  PRIMARY KEY,
    created_at  TIMESTAMP    NOT NULL,
    updated_at  TIMESTAMP    NOT NULL,
    deleted     BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMP,
    actor_id    VARCHAR(36),
    actor_email VARCHAR(100),
    actor_role  VARCHAR(20),
    action      VARCHAR(40)  NOT NULL,
    target_type VARCHAR(50),
    target_id   VARCHAR(36),
    branch_id   VARCHAR(36),
    reason      VARCHAR(500),
    ip_address  VARCHAR(64),
    metadata    TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch ON audit_logs(branch_id, created_at DESC);

-- Enforce append-only at the database level: any UPDATE or DELETE raises.
-- This holds even for the application user, so a bug or a stolen credential
-- cannot rewrite history.
CREATE OR REPLACE FUNCTION forbid_audit_log_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_mutation();

-- =====================================================
-- 6. PRIVILEGE ESCALATION GUARDS
-- =====================================================
CREATE TABLE IF NOT EXISTS role_change_requests (
    id                  VARCHAR(36)  PRIMARY KEY,
    target_user_id      VARCHAR(36)  NOT NULL,
    target_user_email   VARCHAR(100),
    previous_role       VARCHAR(20)  NOT NULL,
    target_role         VARCHAR(20)  NOT NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    requested_by_id     VARCHAR(36)  NOT NULL,
    requested_by_email  VARCHAR(100),
    approved_by_id      VARCHAR(36),
    approved_by_email   VARCHAR(100),
    reason              VARCHAR(500),
    decision_reason     VARCHAR(500),
    requested_at        TIMESTAMP    NOT NULL,
    decided_at          TIMESTAMP,
    CONSTRAINT check_role_change_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_role_change_requests_status ON role_change_requests(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_change_requests_target ON role_change_requests(target_user_id, status);
CREATE INDEX IF NOT EXISTS idx_role_change_requests_approver ON role_change_requests(approved_by_id);

CREATE TABLE IF NOT EXISTS refund_requests (
    id                   VARCHAR(36)   PRIMARY KEY,
    invoice_id           VARCHAR(36)   NOT NULL,
    amount               DECIMAL(12,2) NOT NULL,
    requires_approval    BOOLEAN       NOT NULL DEFAULT FALSE,
    status               VARCHAR(20)   NOT NULL DEFAULT 'PENDING_APPROVAL',
    requested_by_id      VARCHAR(36)   NOT NULL,
    requested_by_email   VARCHAR(100),
    approved_by_id       VARCHAR(36),
    approved_by_email    VARCHAR(100),
    reason               VARCHAR(500)  NOT NULL,
    decision_reason      VARCHAR(500),
    requested_at         TIMESTAMP     NOT NULL,
    decided_at           TIMESTAMP,
    CONSTRAINT check_refund_status CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED'))
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_requests_invoice ON refund_requests(invoice_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_approver ON refund_requests(approved_by_id);

-- =====================================================
-- 7. REFRESH TOKEN ROTATION
-- =====================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         VARCHAR(36)  PRIMARY KEY,
    user_id    VARCHAR(36)  NOT NULL,
    token_hash VARCHAR(128) NOT NULL,
    expires_at TIMESTAMP    NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP    NOT NULL,
    CONSTRAINT uk_refresh_tokens_hash UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expiry ON refresh_tokens(expires_at);