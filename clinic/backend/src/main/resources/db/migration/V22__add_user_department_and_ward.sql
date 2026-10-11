-- V22: Add department and ward columns to users table for staff assignment and filtering.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS department VARCHAR(100);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS ward VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
