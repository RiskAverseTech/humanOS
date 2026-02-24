-- ============================================================================
-- HumanOS – Soft archive for Human Chat channels
-- Migration 00013
-- ============================================================================

ALTER TABLE public.human_chat_channels
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_human_chat_channels_active_updated
  ON public.human_chat_channels (updated_at DESC)
  WHERE archived_at IS NULL;
