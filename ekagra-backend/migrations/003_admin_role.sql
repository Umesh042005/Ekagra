-- ==============================================================================
-- Migration: 003_admin_role.sql
-- Description: Admin role + mentor deactivation.
--
-- 1. Allows role = 'admin' on users (works whether `role` is TEXT + CHECK or an ENUM).
-- 2. Adds users.is_active (deactivated users cannot log in or use the API).
-- 3. Locks `role` and `is_active` so only the backend (service_role) can change
--    them — the existing "Users can update their own profile" policy would
--    otherwise let a user promote themselves to admin.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ==============================================================================

-- Step 1: allow the 'admin' role
DO $$
DECLARE
  role_udt TEXT;
  c RECORD;
BEGIN
  SELECT udt_name INTO role_udt
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role';

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = role_udt AND typtype = 'e') THEN
    -- role is an ENUM type
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', role_udt, 'admin');
  ELSE
    -- role is TEXT: replace any CHECK constraint on it
    FOR c IN
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.users'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%role%'
    LOOP
      EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', c.conname);
    END LOOP;
    ALTER TABLE public.users
      ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'coach', 'admin'));
  END IF;
END $$;

-- Step 2: active / deactivated accounts
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Step 3: only the server may change role / is_active
CREATE OR REPLACE FUNCTION public.protect_user_role_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active)
     AND coalesce(auth.role(), '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
    RAISE EXCEPTION 'role and is_active can only be changed by the Ekagra server';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_user_role_fields ON public.users;
CREATE TRIGGER trg_protect_user_role_fields
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_role_fields();
