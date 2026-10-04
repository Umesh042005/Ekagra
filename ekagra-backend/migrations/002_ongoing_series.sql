-- ==============================================================================
-- Migration: 002_ongoing_series.sql
-- Description: Ongoing (rolling-window) motivation series.
--
-- A `series` row is the recurrence RULE. Concrete `sessions` rows are only
-- materialized for a rolling window (next ~14 days) by the backend's series
-- top-up job. sessions.recurrence_group_id = series.id links the two.
--
-- Run once in the Supabase SQL editor.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS series (
  id                UUID PRIMARY KEY,
  student_id        UUID NOT NULL,
  created_by        UUID NOT NULL,                 -- mentor who set it up
  coach_ids         UUID[] NOT NULL,               -- mentor rotation (round-robin)
  session_title     TEXT NOT NULL,
  time_of_day       TIME NOT NULL,                 -- wall-clock time in IST
  start_date        DATE NOT NULL,                 -- IST date of occurrence #0
  interval_days     INTEGER NOT NULL DEFAULT 2
    CONSTRAINT check_series_interval CHECK (interval_days BETWEEN 1 AND 30),
  duration_minutes  INTEGER NOT NULL DEFAULT 45
    CONSTRAINT check_series_duration CHECK (duration_minutes > 0),
  max_sessions      INTEGER DEFAULT NULL,          -- NULL = ongoing, no end
  zoom_link         TEXT,
  status            TEXT NOT NULL DEFAULT 'active'
    CONSTRAINT check_series_status CHECK (status IN ('active', 'paused', 'ended')),
  next_index        INTEGER NOT NULL DEFAULT 0,    -- next occurrence # to generate
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_series_status ON series (status);
CREATE INDEX IF NOT EXISTS idx_series_coach_ids ON series USING GIN (coach_ids);

-- The backend uses the service_role key (which bypasses RLS); enabling RLS with
-- no policies keeps the table closed to anon/public clients.
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
