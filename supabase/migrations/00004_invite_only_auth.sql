-- ============================================================================
-- HumanOS – Invite-Only Auth Configuration
-- Migration 00004: Restrict signups to invited users only
-- ============================================================================

-- Hardcoded admin email function (avoids ALTER DATABASE which Supabase blocks).
-- To change the admin email, update this function.
CREATE OR REPLACE FUNCTION public.get_admin_email()
RETURNS text AS $$
  SELECT 'jzilahy@gmail.com'::text;
$$ LANGUAGE sql IMMUTABLE;

-- Fix handle_new_user to use the function instead of current_setting
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  _role public.user_role;
  _display_name text;
BEGIN
  -- Check if this user was invited
  SELECT role INTO _role
  FROM public.invitations
  WHERE email = NEW.email AND accepted_at IS NULL
  LIMIT 1;

  -- If invited, use the invited role and mark invitation as accepted
  IF _role IS NOT NULL THEN
    UPDATE public.invitations
    SET accepted_at = now()
    WHERE email = NEW.email AND accepted_at IS NULL;
  END IF;

  -- If the user's email matches the admin email, force admin role
  -- Otherwise, use the invited role or default to 'partner'
  IF NEW.email = public.get_admin_email() THEN
    _role := 'admin';
  ELSIF _role IS NULL THEN
    _role := 'partner';
  END IF;

  -- Use the email prefix as a default display name
  _display_name := split_part(NEW.email, '@', 1);

  INSERT INTO public.profiles (user_id, display_name, role)
  VALUES (NEW.id, _display_name, _role);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function that validates new signups against the invitations table.
-- This prevents anyone who wasn't invited from creating an account,
-- EXCEPT for the admin email which is always allowed.
CREATE OR REPLACE FUNCTION public.validate_invite_on_signup()
RETURNS trigger AS $$
BEGIN
  -- Always allow the admin email
  IF NEW.email = public.get_admin_email() THEN
    RETURN NEW;
  END IF;

  -- Check for a valid pending invitation
  IF NOT EXISTS (
    SELECT 1 FROM public.invitations
    WHERE email = NEW.email
    AND accepted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Signup is invite-only. No valid invitation found for this email.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire BEFORE insert on auth.users to block uninvited signups
CREATE TRIGGER trg_validate_invite_on_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_invite_on_signup();
