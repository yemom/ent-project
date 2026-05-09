-- V4__fix_role_type.sql
-- Fix role column type: change from custom enum user_role to VARCHAR to avoid JDBC binding issues
-- Created: 2026-05-08

-- Drop dependent views/rules, alter column type, then recreate views.
DROP VIEW IF EXISTS patients CASCADE;
DROP VIEW IF EXISTS doctors CASCADE;

ALTER TABLE users
    ALTER COLUMN role TYPE VARCHAR(20) USING role::text;

-- Recreate convenience views (same as original V1)
CREATE VIEW patients AS
SELECT * FROM users WHERE user_type = 'PATIENT';

CREATE VIEW doctors AS
SELECT * FROM users WHERE user_type = 'DOCTOR';

-- If you no longer need the enum type, drop it (optional)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        DROP TYPE user_role;
    END IF;
END$$;
