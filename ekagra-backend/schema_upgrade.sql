-- ==============================================================================
-- Migration: 001_sessions_upgrade.sql, 002_user_avatar.sql, 003_notifications.sql
-- Description: Ekagra Production Session, Profile Photo & Notifications Upgrade
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

-- Step 4: Add avatar_url to `users` table for Profile Photo uploads & RLS policies
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- Enable Row Level Security on users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow users to view registered user profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Authenticated users can view profiles'
  ) THEN
    CREATE POLICY "Authenticated users can view profiles"
    ON users FOR SELECT
    TO authenticated
    USING (true);
  END IF;

  -- Allow users to update their own profile (including avatar_url)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
  END IF;

  -- Allow service_role to manage all user rows
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Service role can manage users'
  ) THEN
    CREATE POLICY "Service role can manage users"
    ON users FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Step 5: Supabase Storage Bucket setup for 'avatars'
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public Avatar Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated User Avatar Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Authenticated User Avatar Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars');

-- Step 6: Notifications Table for in-app alert system
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, is_read, created_at DESC);

-- Grants for notifications table
GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
