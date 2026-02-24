alter table public.chat_messages
add column if not exists reply_to_message_id uuid null references public.chat_messages(id) on delete set null;

create index if not exists chat_messages_reply_to_message_id_idx
  on public.chat_messages (reply_to_message_id);

alter table public.human_chat_messages
add column if not exists reply_to_message_id uuid null references public.human_chat_messages(id) on delete set null;

create index if not exists human_chat_messages_reply_to_message_id_idx
  on public.human_chat_messages (reply_to_message_id);
