create table if not exists public.chat_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists chat_message_reactions_message_id_idx
  on public.chat_message_reactions (message_id, created_at desc);

create table if not exists public.human_chat_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.human_chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists human_chat_message_reactions_message_id_idx
  on public.human_chat_message_reactions (message_id, created_at desc);

alter table public.chat_message_reactions enable row level security;
alter table public.human_chat_message_reactions enable row level security;

drop policy if exists "chat_message_reactions_select_auth" on public.chat_message_reactions;
create policy "chat_message_reactions_select_auth"
  on public.chat_message_reactions
  for select
  to authenticated
  using (true);

drop policy if exists "chat_message_reactions_insert_own" on public.chat_message_reactions;
create policy "chat_message_reactions_insert_own"
  on public.chat_message_reactions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "chat_message_reactions_delete_own" on public.chat_message_reactions;
create policy "chat_message_reactions_delete_own"
  on public.chat_message_reactions
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "human_chat_message_reactions_select_auth" on public.human_chat_message_reactions;
create policy "human_chat_message_reactions_select_auth"
  on public.human_chat_message_reactions
  for select
  to authenticated
  using (true);

drop policy if exists "human_chat_message_reactions_insert_own" on public.human_chat_message_reactions;
create policy "human_chat_message_reactions_insert_own"
  on public.human_chat_message_reactions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "human_chat_message_reactions_delete_own" on public.human_chat_message_reactions;
create policy "human_chat_message_reactions_delete_own"
  on public.human_chat_message_reactions
  for delete
  to authenticated
  using (auth.uid() = user_id);
