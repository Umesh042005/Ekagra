-- ==============================================================================
-- Migration: 001_sessions_upgrade.sql
-- Description: Ekagra Production Session Schema Upgrade
-- ==============================================================================

-- Step 1: Add new columns to `sessions` table
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'study' 
    CONSTRAINT check_session_type CHECK (session_type IN ('study', 'motivation')),
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 45 
    CONSTRAINT check_positive_duration CHECK (duration_minutes > 0),
  ADD COLUMN IF NOT EXISTS recurrence_group_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS session_title TEXT DEFAULT NULL;

-- Step 2: Database-level unique partial indexes to prevent double bookings
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_student_unique_slot
  ON sessions (student_id, scheduled_at)
  WHERE status != 'cancelled';

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_coach_unique_slot
  ON sessions (coach_id, scheduled_at)
  WHERE status != 'cancelled';

-- Step 3: High-performance composite query indexes
CREATE INDEX IF NOT EXISTS idx_sessions_student_status_scheduled
  ON sessions (student_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_sessions_coach_status_scheduled
  ON sessions (coach_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_sessions_recurrence_group
  ON sessions (recurrence_group_id);

CREATE INDEX IF NOT EXISTS idx_sessions_status_scheduled
  ON sessions (status, scheduled_at);
