-- ============================================================================
-- HumanOS – Shared Content Editing + Chat Sender Tracking
-- Migration 00010: Allow any member to edit shared content,
--                  add sender_id to chat messages for multi-user threads
-- ============================================================================

-- ============================================================================
-- NOTES – Allow editing/deleting shared notes by any authenticated user
-- ============================================================================
CREATE POLICY "notes_update_shared"
  ON public.notes FOR UPDATE
  TO authenticated
  USING (is_shared = true)
  WITH CHECK (is_shared = true);

CREATE POLICY "notes_delete_shared"
  ON public.notes FOR DELETE
  TO authenticated
  USING (is_shared = true);

-- ============================================================================
-- DOCUMENTS – Allow editing shared documents metadata
-- ============================================================================
CREATE POLICY "documents_update_shared"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (is_shared = true)
  WITH CHECK (is_shared = true);

-- ============================================================================
-- CHAT THREADS – Allow updating shared threads (title, privacy, lock state)
-- ============================================================================
CREATE POLICY "chat_threads_update_shared"
  ON public.chat_threads FOR UPDATE
  TO authenticated
  USING (is_shared = true);

CREATE POLICY "chat_threads_delete_shared"
  ON public.chat_threads FOR DELETE
  TO authenticated
  USING (is_shared = true);

-- ============================================================================
-- CHAT MESSAGES – Allow deleting messages in shared threads
-- ============================================================================
CREATE POLICY "chat_messages_delete_shared_thread"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_threads
      WHERE chat_threads.id = chat_messages.thread_id
      AND chat_threads.is_shared = true
    )
  );

-- ============================================================================
-- TODO CARDS – Allow editing/deleting shared todo cards
-- ============================================================================
CREATE POLICY "todo_cards_update_shared"
  ON public.todo_cards FOR UPDATE
  TO authenticated
  USING (is_shared = true)
  WITH CHECK (is_shared = true);

CREATE POLICY "todo_cards_delete_shared"
  ON public.todo_cards FOR DELETE
  TO authenticated
  USING (is_shared = true);

-- ============================================================================
-- CHAT MESSAGES – Add sender_id for multi-user thread support
-- ============================================================================
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS sender_id uuid REFERENCES auth.users(id);
