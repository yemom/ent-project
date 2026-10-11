-- V21: full Super Admin user management.
--
-- The admin screens could create staff, but three things needed to make the account
-- lifecycle safe were missing:
--
--   1. must_change_password - a Super Admin can hand out a temporary credential,
--      and the account must be forced to replace it on first sign-in.
--   2. deactivation_reason / deactivated_at - deactivation without a recorded reason
--      is indistinguishable from a bug, and "why did this person lose access?" has to
--      be answerable months later.
--   3. address - a patient registration needs a postal address; the entity had
--      emergency contacts and demographics but nowhere to put it.
--
-- All additive, and every existing column is nullable or has a default, so this is
-- safe to run against a populated database.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS deactivation_reason VARCHAR(500);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS address VARCHAR(300);

-- Listing accounts by role and status is the admin table's primary access path and
-- was previously an unindexed scan of the whole table.
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, active);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch_id);

-- Deleting an account is a soft delete (deleted = true). This keeps the
-- "not deleted" filter cheap on the hot list endpoint.
CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted);
