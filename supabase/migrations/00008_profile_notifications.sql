-- ============================================================================
-- HumanOS – Profile Notification Preferences
-- Migration 00008
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_categories text[] NOT NULL DEFAULT ARRAY[
    'notes',
    'vault',
    'todos',
    'human_chat',
    'ai_chat',
    'images'
  ]::text[],
  ADD COLUMN IF NOT EXISTS notifications_last_seen_at timestamptz NOT NULL DEFAULT now();
