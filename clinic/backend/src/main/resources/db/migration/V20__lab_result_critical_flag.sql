-- V20: critical-result flag on lab results.
--
-- The task requires critical-result alerting, and LabResult had no way to express
-- it: a result could only be DRAFT or FINAL. A critical value therefore could not
-- be distinguished from a routine one, which is the single most important signal
-- a laboratory produces.
--
-- Additive and safe: the column is NOT NULL DEFAULT FALSE, so every existing row
-- is a non-critical result and no historical result changes meaning.

ALTER TABLE lab_results
    ADD COLUMN IF NOT EXISTS is_critical BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_lab_results_critical
    ON lab_results(is_critical, status);

-- Historical critical results that were never flagged stay FALSE. Backfilling
-- would be guesswork and could raise alerts for results nobody reviewed, so the
-- flag starts empty and is set prospectively by the technician recording it.