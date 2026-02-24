-- ============================================================================
-- HumanOS – Row Level Security Policies
-- Migration 00002: Enable RLS and create policies for all tables
-- ============================================================================

-- ============================================================================
-- PROFILES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated members can view all profiles
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own profile (display_name, avatar_url only)
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Only admin can update any profile (e.g. changing roles)
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Profiles are created by the trigger, not directly by users
-- No INSERT policy needed for authenticated users

-- ============================================================================
-- INVITATIONS
-- ============================================================================
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Only admin can create invitations
CREATE POLICY "invitations_insert_admin"
  ON public.invitations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admin can view all invitations
CREATE POLICY "invitations_select_admin"
  ON public.invitations FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Anyone can view invitations by token (for accepting invites)
-- This is handled via the service role client, so no public policy needed

-- Admin can delete/revoke invitations
CREATE POLICY "invitations_delete_admin"
  ON public.invitations FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- NOTES
-- ============================================================================
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- Users can see their own notes
CREATE POLICY "notes_select_own"
  ON public.notes FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- All members can see shared notes
CREATE POLICY "notes_select_shared"
  ON public.notes FOR SELECT
  TO authenticated
  USING (is_shared = true);

-- Users can create their own notes
CREATE POLICY "notes_insert_own"
  ON public.notes FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Users can update their own notes
CREATE POLICY "notes_update_own"
  ON public.notes FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Users can delete their own notes
CREATE POLICY "notes_delete_own"
  ON public.notes FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ============================================================================
-- DOCUMENTS
-- ============================================================================
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Users can see their own documents
CREATE POLICY "documents_select_own"
  ON public.documents FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- All members can see shared documents
CREATE POLICY "documents_select_shared"
  ON public.documents FOR SELECT
  TO authenticated
  USING (is_shared = true);

-- Users can upload their own documents
CREATE POLICY "documents_insert_own"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Users can update their own documents
CREATE POLICY "documents_update_own"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Users can delete their own documents
CREATE POLICY "documents_delete_own"
  ON public.documents FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ============================================================================
-- CHAT THREADS
-- ============================================================================
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

-- Users can see their own threads
CREATE POLICY "chat_threads_select_own"
  ON public.chat_threads FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- All members can see shared threads
CREATE POLICY "chat_threads_select_shared"
  ON public.chat_threads FOR SELECT
  TO authenticated
  USING (is_shared = true);

-- Users can create their own threads
CREATE POLICY "chat_threads_insert_own"
  ON public.chat_threads FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Users can update their own threads
CREATE POLICY "chat_threads_update_own"
  ON public.chat_threads FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Users can delete their own threads
CREATE POLICY "chat_threads_delete_own"
  ON public.chat_threads FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ============================================================================
-- CHAT MESSAGES
-- ============================================================================
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can see messages in threads they own
CREATE POLICY "chat_messages_select_own_thread"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_threads
      WHERE chat_threads.id = chat_messages.thread_id
      AND chat_threads.owner_id = auth.uid()
    )
  );

-- Users can see messages in shared threads
CREATE POLICY "chat_messages_select_shared_thread"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_threads
      WHERE chat_threads.id = chat_messages.thread_id
      AND chat_threads.is_shared = true
    )
  );

-- Users can insert messages into threads they own
CREATE POLICY "chat_messages_insert_own_thread"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_threads
      WHERE chat_threads.id = chat_messages.thread_id
      AND chat_threads.owner_id = auth.uid()
    )
  );

-- Users can insert messages into shared threads
CREATE POLICY "chat_messages_insert_shared_thread"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_threads
      WHERE chat_threads.id = chat_messages.thread_id
      AND chat_threads.is_shared = true
    )
  );

-- Users can delete messages in threads they own
CREATE POLICY "chat_messages_delete_own_thread"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_threads
      WHERE chat_threads.id = chat_messages.thread_id
      AND chat_threads.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- GENERATED IMAGES
-- ============================================================================
ALTER TABLE public.generated_images ENABLE ROW LEVEL SECURITY;

-- Users can see their own generated images
CREATE POLICY "generated_images_select_own"
  ON public.generated_images FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- All members can see all generated images (gallery view)
CREATE POLICY "generated_images_select_all"
  ON public.generated_images FOR SELECT
  TO authenticated
  USING (true);

-- Only non-child users can create images (enforced at API level too)
CREATE POLICY "generated_images_insert_adults"
  ON public.generated_images FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.get_user_role() IN ('admin', 'partner')
  );

-- Users can delete their own generated images
CREATE POLICY "generated_images_delete_own"
  ON public.generated_images FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());
