-- ============================================================================
-- HumanOS – Activity Events (actor-based notifications)
-- Migration 00009
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('notes', 'vault', 'todos', 'human_chat', 'ai_chat', 'images')),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  title text NOT NULL,
  href text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_events_created_at_idx
  ON public.activity_events (created_at DESC);

CREATE INDEX IF NOT EXISTS activity_events_category_created_at_idx
  ON public.activity_events (category, created_at DESC);

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'activity_events'
      AND policyname = 'Authenticated users can read activity events'
  ) THEN
    CREATE POLICY "Authenticated users can read activity events"
      ON public.activity_events FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'activity_events'
      AND policyname = 'Authenticated users can insert activity events'
  ) THEN
    CREATE POLICY "Authenticated users can insert activity events"
      ON public.activity_events FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = actor_user_id);
  END IF;
END $$;
