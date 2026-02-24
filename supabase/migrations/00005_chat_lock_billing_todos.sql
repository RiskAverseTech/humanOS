-- ============================================================================
-- HumanOS – Chat Locking, Billing Settings, and To Dos
-- Migration 00005
-- ============================================================================

-- 1. Chat thread generation lock columns
-- ============================================================================
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS is_generating boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS generation_started_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_chat_threads_generating
  ON public.chat_threads (is_generating, generation_started_at);

-- 2. App settings (single-row table, admin-managed)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  billing_openai_gpt4o_input_per_mtok numeric NOT NULL DEFAULT 2.5,
  billing_openai_gpt4o_output_per_mtok numeric NOT NULL DEFAULT 10,
  billing_anthropic_sonnet_input_per_mtok numeric NOT NULL DEFAULT 3,
  billing_anthropic_sonnet_output_per_mtok numeric NOT NULL DEFAULT 15,
  billing_gpt_image_15_per_image numeric NOT NULL DEFAULT 0.042,
  billing_gpt_image_1_per_image numeric NOT NULL DEFAULT 0.040,
  billing_dalle3_per_image numeric NOT NULL DEFAULT 0.080,
  billing_fallback_image_per_image numeric NOT NULL DEFAULT 0.050,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

INSERT INTO public.app_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_select_authenticated" ON public.app_settings;
CREATE POLICY "app_settings_select_authenticated"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "app_settings_update_admin" ON public.app_settings;
CREATE POLICY "app_settings_update_admin"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. To Do sticky cards and checklist items
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.todo_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled list',
  is_shared boolean NOT NULL DEFAULT true,
  color text NOT NULL DEFAULT 'yellow',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.todo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.todo_cards(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_todo_cards_owner ON public.todo_cards(owner_id);
CREATE INDEX IF NOT EXISTS idx_todo_cards_updated ON public.todo_cards(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_todo_items_card ON public.todo_items(card_id, position, created_at);

DROP TRIGGER IF EXISTS trg_todo_cards_updated_at ON public.todo_cards;
CREATE TRIGGER trg_todo_cards_updated_at
  BEFORE UPDATE ON public.todo_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.todo_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "todo_cards_select_own" ON public.todo_cards;
CREATE POLICY "todo_cards_select_own"
  ON public.todo_cards FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "todo_cards_select_shared" ON public.todo_cards;
CREATE POLICY "todo_cards_select_shared"
  ON public.todo_cards FOR SELECT
  TO authenticated
  USING (is_shared = true);

DROP POLICY IF EXISTS "todo_cards_insert_own" ON public.todo_cards;
CREATE POLICY "todo_cards_insert_own"
  ON public.todo_cards FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "todo_cards_update_own" ON public.todo_cards;
CREATE POLICY "todo_cards_update_own"
  ON public.todo_cards FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "todo_cards_delete_own" ON public.todo_cards;
CREATE POLICY "todo_cards_delete_own"
  ON public.todo_cards FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "todo_items_select_visible_card" ON public.todo_items;
CREATE POLICY "todo_items_select_visible_card"
  ON public.todo_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.todo_cards
      WHERE todo_cards.id = todo_items.card_id
        AND (todo_cards.owner_id = auth.uid() OR todo_cards.is_shared = true)
    )
  );

DROP POLICY IF EXISTS "todo_items_insert_visible_card" ON public.todo_items;
CREATE POLICY "todo_items_insert_visible_card"
  ON public.todo_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.todo_cards
      WHERE todo_cards.id = todo_items.card_id
        AND (todo_cards.owner_id = auth.uid() OR todo_cards.is_shared = true)
    )
  );

DROP POLICY IF EXISTS "todo_items_update_visible_card" ON public.todo_items;
CREATE POLICY "todo_items_update_visible_card"
  ON public.todo_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.todo_cards
      WHERE todo_cards.id = todo_items.card_id
        AND (todo_cards.owner_id = auth.uid() OR todo_cards.is_shared = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.todo_cards
      WHERE todo_cards.id = todo_items.card_id
        AND (todo_cards.owner_id = auth.uid() OR todo_cards.is_shared = true)
    )
  );

DROP POLICY IF EXISTS "todo_items_delete_visible_card" ON public.todo_items;
CREATE POLICY "todo_items_delete_visible_card"
  ON public.todo_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.todo_cards
      WHERE todo_cards.id = todo_items.card_id
        AND (todo_cards.owner_id = auth.uid() OR todo_cards.is_shared = true)
    )
  );
