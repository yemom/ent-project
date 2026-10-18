-- Idempotency for notifications.
--
-- The notification rows written so far had no way to say "this exact event has
-- already been announced". A retried request, a double-clicked Save button, or a
-- replayed webhook produced a second identical notification for the same recipient,
-- which is how a bell fills with noise and gets ignored.
--
-- event_key is a deterministic string derived from the business event — the
-- event type, the resource, the new state and the recipient. UNIQUE makes the
-- guarantee hold under concurrency, not merely in the common case: two
-- simultaneous inserts of the same event leave exactly one row, and the loser is
-- caught and discarded rather than surfacing an error to the caller who triggered
-- a legitimate, successful business operation.
--
-- NULL for legacy rows and for notifications that are not tied to a single
-- business event (manual broadcasts). NULLs do not collide, so existing rows keep
-- working untouched.

ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS event_key VARCHAR(300);

-- Partial-ish uniqueness: H2 and PostgreSQL both treat NULLs as distinct in a
-- UNIQUE constraint, so one global index is enough and needs no dialect-specific
-- syntax.
CREATE UNIQUE INDEX IF NOT EXISTS uk_notifications_event_key
    ON notifications (event_key);

-- Serves the "already announced?" lookup used before an insert on the hot path.
CREATE INDEX IF NOT EXISTS idx_notifications_event_key_lookup
    ON notifications (event_key);