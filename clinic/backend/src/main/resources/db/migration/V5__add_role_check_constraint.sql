-- V5__add_role_check_constraint.sql
-- Add CHECK constraint to role column to restrict values without removing enum type
-- Created: 2026-05-08

ALTER TABLE users
    ADD CONSTRAINT check_role_values CHECK (role IN ('ADMIN', 'DOCTOR', 'PATIENT'));
