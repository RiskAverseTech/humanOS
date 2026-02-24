-- ============================================================================
-- HumanOS – Human Chat Channels + Uploads
-- Migration 00006
-- ============================================================================

-- 1. Family chat channels (shared by all authenticated users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.human_chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_human_chat_channels_updated
  ON public.human_chat_channels (updated_at DESC);

DROP TRIGGER IF EXISTS trg_human_chat_channels_updated_at ON public.human_chat_channels;
CREATE TRIGGER trg_human_chat_channels_updated_at
  BEFORE UPDATE ON public.human_chat_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 2. Channel messages (text and/or image attachment)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.human_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.human_chat_channels(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  image_storage_path text,
  image_mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT human_chat_message_not_empty CHECK (
    coalesce(length(trim(content)), 0) > 0 OR image_storage_path IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_human_chat_messages_channel
  ON public.human_chat_messages (channel_id, created_at);

-- 3. RLS
-- ============================================================================
ALTER TABLE public.human_chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "human_chat_channels_select_all" ON public.human_chat_channels;
CREATE POLICY "human_chat_channels_select_all"
  ON public.human_chat_channels FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "human_chat_channels_insert_authenticated" ON public.human_chat_channels;
CREATE POLICY "human_chat_channels_insert_authenticated"
  ON public.human_chat_channels FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "human_chat_channels_update_owner" ON public.human_chat_channels;
CREATE POLICY "human_chat_channels_update_owner"
  ON public.human_chat_channels FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "human_chat_channels_delete_owner" ON public.human_chat_channels;
CREATE POLICY "human_chat_channels_delete_owner"
  ON public.human_chat_channels FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "human_chat_messages_select_all" ON public.human_chat_messages;
CREATE POLICY "human_chat_messages_select_all"
  ON public.human_chat_messages FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "human_chat_messages_insert_authenticated" ON public.human_chat_messages;
CREATE POLICY "human_chat_messages_insert_authenticated"
  ON public.human_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "human_chat_messages_update_author" ON public.human_chat_messages;
CREATE POLICY "human_chat_messages_update_author"
  ON public.human_chat_messages FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "human_chat_messages_delete_author" ON public.human_chat_messages;
CREATE POLICY "human_chat_messages_delete_author"
  ON public.human_chat_messages FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- 4. Chat uploads storage bucket (private, signed URLs)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-uploads',
  'chat-uploads',
  false,
  10485760, -- 10MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_uploads_insert_own" ON storage.objects;
CREATE POLICY "chat_uploads_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "chat_uploads_select_all" ON storage.objects;
CREATE POLICY "chat_uploads_select_all"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'chat-uploads');

DROP POLICY IF EXISTS "chat_uploads_delete_own" ON storage.objects;
CREATE POLICY "chat_uploads_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
