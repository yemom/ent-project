-- Add pharmacist-specific columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS employee_number VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS pharmacy_location VARCHAR(100);

-- Update constraints to include PHARMACIST
ALTER TABLE users
DROP CONSTRAINT IF EXISTS check_patient_type;

ALTER TABLE users
ADD CONSTRAINT check_user_type CHECK (user_type IN ('PATIENT', 'DOCTOR', 'ADMIN', 'PHARMACIST'));

ALTER TABLE users
DROP CONSTRAINT IF EXISTS check_role_values;

ALTER TABLE users  
ADD CONSTRAINT check_role_values CHECK (role::text = ANY (ARRAY['ADMIN'::character varying, 'DOCTOR'::character varying, 'PATIENT'::character varying, 'PHARMACIST'::character varying]::text[]));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employee_number ON users(employee_number) WHERE employee_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pharmacy_location ON users(pharmacy_location) WHERE pharmacy_location IS NOT NULL;
