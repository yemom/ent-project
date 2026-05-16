-- V11: Update role constraint to include PHARMACIST and LABORATORY

ALTER TABLE users
DROP CONSTRAINT IF EXISTS check_role_values;

ALTER TABLE users
ADD CONSTRAINT check_role_values CHECK (role IN ('ADMIN', 'DOCTOR', 'PATIENT', 'PHARMACIST', 'LABORATORY'));

-- Also ensure user_type and LABORATORY roles are consistent
ALTER TABLE users
DROP CONSTRAINT IF EXISTS check_user_type;

ALTER TABLE users
ADD CONSTRAINT check_user_type CHECK (user_type IN ('PATIENT', 'DOCTOR', 'ADMIN', 'PHARMACIST', 'LABORATORY'));
