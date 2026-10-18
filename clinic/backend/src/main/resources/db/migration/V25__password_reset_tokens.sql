-- Password reset tokens.
--
-- Only the SHA-256 hash of the emailed token is stored, matching the treatment
-- already given to refresh tokens: a dump of this table is not a set of usable
-- reset links.
--
-- The rows are deliberately NOT soft-deleted. "When was this token spent, and for
-- which account" is a question a security review will ask, and a `deleted` flag
-- that the application controls would answer it with whatever it was told to.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          VARCHAR(36)  NOT NULL,
    user_id     VARCHAR(36)  NOT NULL,
    token_hash  VARCHAR(64)  NOT NULL,
    expires_at  TIMESTAMP    NOT NULL,
    used_at     TIMESTAMP    NULL,
    created_at  TIMESTAMP    NOT NULL,
    CONSTRAINT pk_password_reset_tokens PRIMARY KEY (id),
    CONSTRAINT uk_password_reset_tokens_hash UNIQUE (token_hash)
);

-- Serves both the per-account issuance cap and the expiry sweep.
CREATE INDEX IF NOT EXISTS idx_password_reset_user
    ON password_reset_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_expiry
    ON password_reset_tokens (expires_at);

-- The reset workflow must not be able to reference a user that does not exist.
ALTER TABLE password_reset_tokens
    ADD CONSTRAINT fk_password_reset_tokens_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;