-- ============================================================================
-- HumanOS – Initial Schema
-- Migration 00001: Tables, enums, indexes, triggers
-- ============================================================================

-- 1. Custom enum for user roles
-- ============================================================================
CREATE TYPE public.user_role AS ENUM ('admin', 'partner', 'child');

-- 2. Profiles table (extends Supabase auth.users)
-- ============================================================================
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  role        public.user_role NOT NULL DEFAULT 'partner',
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Family member profiles, one per auth user';

-- 3. Invitations table (invite-only auth)
-- ============================================================================
CREATE TABLE public.invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  role        public.user_role NOT NULL DEFAULT 'partner',
  invited_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       uuid NOT NULL DEFAULT gen_random_uuid(),
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_invitations_email_pending
  ON public.invitations(email)
  WHERE accepted_at IS NULL;

CREATE UNIQUE INDEX idx_invitations_token
  ON public.invitations(token);

COMMENT ON TABLE public.invitations IS 'Invite tokens for new members';

-- 4. Notes table
-- ============================================================================
CREATE TABLE public.notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         text NOT NULL DEFAULT 'Untitled',
  content       text,
  is_shared     boolean NOT NULL DEFAULT false,
  tags          text[] NOT NULL DEFAULT '{}',
  folder_path   text,
  search_vector tsvector,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Full-text search index
CREATE INDEX idx_notes_search ON public.notes USING gin(search_vector);
CREATE INDEX idx_notes_owner ON public.notes(owner_id);
CREATE INDEX idx_notes_folder ON public.notes(folder_path);
CREATE INDEX idx_notes_tags ON public.notes USING gin(tags);

-- Auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION public.notes_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notes_search_vector
  BEFORE INSERT OR UPDATE OF title, content
  ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.notes_search_vector_update();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.notes IS 'User notes with rich text content';

-- 5. Documents table
-- ============================================================================
CREATE TABLE public.documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name     text NOT NULL,
  storage_path  text NOT NULL,
  mime_type     text NOT NULL,
  is_shared     boolean NOT NULL DEFAULT false,
  tags          text[] NOT NULL DEFAULT '{}',
  folder_path   text,
  size          bigint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_owner ON public.documents(owner_id);
CREATE INDEX idx_documents_folder ON public.documents(folder_path);
CREATE INDEX idx_documents_tags ON public.documents USING gin(tags);

COMMENT ON TABLE public.documents IS 'File metadata for the document vault';

-- 6. Chat threads table
-- ============================================================================
CREATE TABLE public.chat_threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_shared   boolean NOT NULL DEFAULT false,
  title       text NOT NULL DEFAULT 'New Chat',
  model       text NOT NULL DEFAULT 'claude-sonnet-4-6',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_threads_owner ON public.chat_threads(owner_id);

COMMENT ON TABLE public.chat_threads IS 'AI chat conversation threads';

-- 7. Chat messages table
-- ============================================================================
CREATE TABLE public.chat_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_thread ON public.chat_messages(thread_id, created_at);

COMMENT ON TABLE public.chat_messages IS 'Individual messages within chat threads';

-- 8. Generated images table
-- ============================================================================
CREATE TABLE public.generated_images (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt        text NOT NULL,
  storage_path  text NOT NULL,
  model         text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_generated_images_owner ON public.generated_images(owner_id);

COMMENT ON TABLE public.generated_images IS 'AI-generated image records';

-- 9. Helper function: get current user role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_user_role IS 'Returns the role of the currently authenticated user';

-- 10. Helper function: check if user is admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.is_admin IS 'Returns true if the current user has the admin role';

-- 11. Admin email helper (hardcoded – Supabase blocks ALTER DATABASE)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_admin_email()
RETURNS text AS $$
  SELECT 'jzilahy@gmail.com'::text;
$$ LANGUAGE sql IMMUTABLE;

-- 12. Auto-create profile on signup via trigger
-- ============================================================================
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
