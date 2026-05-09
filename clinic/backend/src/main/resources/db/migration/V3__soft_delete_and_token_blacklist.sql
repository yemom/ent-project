-- V3__soft_delete_and_token_blacklist.sql
-- Adds soft delete columns and the JWT blacklist table
-- Created: May 6, 2026

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

ALTER TABLE medical_records
    ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted);
CREATE INDEX IF NOT EXISTS idx_appointments_deleted ON appointments(deleted);
CREATE INDEX IF NOT EXISTS idx_medical_records_deleted ON medical_records(deleted);

CREATE TABLE IF NOT EXISTS token_blacklist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(2048) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    blacklisted_at TIMESTAMP NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blacklisted_token ON token_blacklist(token);
CREATE INDEX IF NOT EXISTS idx_blacklisted_token_expires_at ON token_blacklist(expires_at);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_deleted ON token_blacklist(deleted);
