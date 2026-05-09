-- V9: Add pharmacist-specific fields to users table

-- Add pharmacist-specific columns if they don't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS employee_number VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS pharmacy_location VARCHAR(100);

-- Update the check constraint to include PHARMACIST
-- First, drop the existing constraint
ALTER TABLE users
DROP CONSTRAINT IF EXISTS check_patient_type;

-- Add new constraint that includes PHARMACIST
ALTER TABLE users
ADD CONSTRAINT check_user_type CHECK (user_type IN ('PATIENT', 'DOCTOR', 'ADMIN', 'PHARMACIST'));

-- Create index on employee_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_employee_number ON users(employee_number) WHERE employee_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pharmacy_location ON users(pharmacy_location) WHERE pharmacy_location IS NOT NULL;
