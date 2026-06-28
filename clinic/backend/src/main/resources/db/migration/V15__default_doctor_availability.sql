-- Ensure all doctors are marked available by default.
UPDATE users
SET available = TRUE
WHERE user_type = 'DOCTOR'
  AND (available IS NULL OR available = FALSE);

-- Provide a default clinic location for scheduling when none exists yet.
INSERT INTO laboratories (
    id,
    name,
    location,
    phone,
    email,
    status,
    operating_hours_start,
    operating_hours_end,
    description,
    deleted,
    created_at,
    updated_at
)
SELECT
    'a0000000-0000-4000-8000-000000000001',
    'Main Clinic',
    'Main Building',
    '+1234567890',
    'clinic@main.local',
    'ACTIVE',
    '08:00',
    '18:00',
    'Default clinic location for doctor availability scheduling',
    FALSE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM laboratories WHERE deleted = FALSE
);
