-- V24: branches table for multi-branch hospital management.
CREATE TABLE IF NOT EXISTS branches (
    id          VARCHAR(36) PRIMARY KEY,
    created_at  TIMESTAMP NOT NULL,
    updated_at  TIMESTAMP NOT NULL,
    deleted     BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMP,
    name        VARCHAR(200) NOT NULL,
    code        VARCHAR(40) NOT NULL UNIQUE,
    address     VARCHAR(300),
    phone       VARCHAR(30),
    email       VARCHAR(120),
    type        VARCHAR(100),
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    notes       TEXT
);
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches(active);
CREATE INDEX IF NOT EXISTS idx_branches_code ON branches(code);
