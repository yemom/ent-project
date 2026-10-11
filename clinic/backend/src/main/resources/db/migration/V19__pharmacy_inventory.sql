-- V19: pharmacy inventory.
--
-- The pharmacy pages and nav entries existed, but there was no stock model behind
-- them: no medicine, batch, supplier or movement table. Everything below is
-- additive.
--
-- Design notes:
--   * `medicines` is the catalogue; `stock_batches` holds the physical lots with
--     their own expiry and quantity; `stock_movements` is an append-only ledger.
--   * Quantity on a batch is the current balance and is only ever changed through a
--     movement, so the ledger and the balance can always be reconciled.
--   * A CHECK constraint enforces quantity >= 0 at the database level. Application
--     validation alone would be bypassable by any direct SQL or future code path.
--   * `stock_movements` is append-only: the audit triggers from V3 are extended to
--     it in the same migration so history cannot be edited away.

-- Drop stale pharmacy tables (in dependency order) if suppliers.name is missing.
-- This handles partial/failed runs that left the tables incomplete.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'suppliers' AND column_name = 'name') THEN
        DROP TABLE IF EXISTS stock_movements CASCADE;
        DROP TABLE IF EXISTS stock_batches    CASCADE;
        DROP TABLE IF EXISTS medicines        CASCADE;
        DROP TABLE IF EXISTS suppliers        CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS suppliers (
    id           VARCHAR(36)  PRIMARY KEY,
    created_at   TIMESTAMP    NOT NULL,
    updated_at   TIMESTAMP    NOT NULL,
    deleted      BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at   TIMESTAMP,
    name         VARCHAR(150) NOT NULL,
    contact_name VARCHAR(120),
    email        VARCHAR(150),
    phone        VARCHAR(40),
    address      VARCHAR(300),
    active       BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(active);

CREATE TABLE IF NOT EXISTS medicines (
    id           VARCHAR(36)  PRIMARY KEY,
    created_at   TIMESTAMP    NOT NULL,
    updated_at   TIMESTAMP    NOT NULL,
    deleted      BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at   TIMESTAMP,
    name         VARCHAR(150) NOT NULL,
    code         VARCHAR(40)  NOT NULL,
    category     VARCHAR(60)  NOT NULL DEFAULT 'GENERAL',
    form         VARCHAR(60),
    strength     VARCHAR(60),
    unit         VARCHAR(30)  NOT NULL DEFAULT 'unit',
    -- Reorder threshold that drives the low-stock alert. Kept on the catalogue so
    -- the alert is a property of the medicine, not of one batch.
    reorder_level NUMERIC(12, 2) NOT NULL DEFAULT 0,
    unit_cost    NUMERIC(12, 2) NOT NULL DEFAULT 0,
    requires_prescription BOOLEAN NOT NULL DEFAULT TRUE,
    active       BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT uk_medicines_code UNIQUE (code),
    CONSTRAINT check_medicines_reorder CHECK (reorder_level >= 0),
    CONSTRAINT check_medicines_cost CHECK (unit_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_category ON medicines(category);
CREATE INDEX IF NOT EXISTS idx_medicines_active ON medicines(active);

CREATE TABLE IF NOT EXISTS stock_batches (
    id           VARCHAR(36)   PRIMARY KEY,
    created_at   TIMESTAMP     NOT NULL,
    updated_at   TIMESTAMP     NOT NULL,
    deleted      BOOLEAN       NOT NULL DEFAULT FALSE,
    deleted_at   TIMESTAMP,
    medicine_id  VARCHAR(36)   NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    supplier_id  VARCHAR(36)   REFERENCES suppliers(id) ON DELETE SET NULL,
    batch_number VARCHAR(60)   NOT NULL,
    expiry_date  DATE          NOT NULL,
    quantity     NUMERIC(12, 2) NOT NULL DEFAULT 0,
    -- Cost captured at receipt time. Held per batch rather than on the medicine so
    -- historical cost is not rewritten when the catalogue price changes.
    unit_cost    NUMERIC(12, 2) NOT NULL DEFAULT 0,
    received_at  TIMESTAMP     NOT NULL,
    notes        VARCHAR(500),
    CONSTRAINT uk_stock_batches_batch UNIQUE (medicine_id, batch_number),
    CONSTRAINT check_stock_batches_quantity CHECK (quantity >= 0),
    CONSTRAINT check_stock_batches_cost CHECK (unit_cost >= 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_batches_medicine ON stock_batches(medicine_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_stock_batches_expiry ON stock_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_stock_batches_supplier ON stock_batches(supplier_id);

CREATE TABLE IF NOT EXISTS stock_movements (
    id             VARCHAR(36)   PRIMARY KEY,
    created_at     TIMESTAMP     NOT NULL,
    updated_at     TIMESTAMP     NOT NULL,
    deleted        BOOLEAN       NOT NULL DEFAULT FALSE,
    deleted_at     TIMESTAMP,
    medicine_id    VARCHAR(36)   NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
    batch_id       VARCHAR(36)   REFERENCES stock_batches(id) ON DELETE SET NULL,
    -- RECEIVED | DISPENSED | RETURNED | DAMAGED | EXPIRED | ADJUSTED
    kind           VARCHAR(20)   NOT NULL,
    -- Signed effect on the batch balance. Positive adds stock, negative removes.
    quantity       NUMERIC(12, 2) NOT NULL,
    balance_after  NUMERIC(12, 2) NOT NULL,
    unit_cost      NUMERIC(12, 2) NOT NULL DEFAULT 0,
    reference      VARCHAR(120),
    reason         VARCHAR(500),
    performed_by_id   VARCHAR(36),
    performed_by_name VARCHAR(100),
    -- The prescription or invoice this movement answers, when applicable.
    prescription_order_id VARCHAR(36),
    performed_at   TIMESTAMP     NOT NULL,
    CONSTRAINT check_stock_movements_kind CHECK (
        kind IN ('RECEIVED', 'DISPENSED', 'RETURNED', 'DAMAGED', 'EXPIRED', 'ADJUSTED')),
    CONSTRAINT check_stock_movements_quantity CHECK (quantity > 0),
    CONSTRAINT check_stock_movements_balance CHECK (balance_after >= 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_medicine ON stock_movements(medicine_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_batch ON stock_movements(batch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_kind ON stock_movements(kind, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_performed_by ON stock_movements(performed_by_id);

-- The movement ledger is history: block UPDATE and DELETE exactly like audit_logs
-- so a stock movement cannot be quietly rewritten after the fact.
CREATE OR REPLACE FUNCTION block_stock_movement_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'stock_movements is append-only; record a correcting movement instead';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_movements_immutable ON stock_movements;
CREATE TRIGGER trg_stock_movements_immutable
    BEFORE UPDATE OR DELETE ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION block_stock_movement_mutation();