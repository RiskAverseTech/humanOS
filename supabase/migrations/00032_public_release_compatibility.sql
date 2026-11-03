-- Forward port of private presence migration 00014; public 00014 is unchanged.
alter table public.profiles add column if not exists last_active_at timestamptz;
create index if not exists idx_profiles_last_active_at
  on public.profiles (last_active_at desc);

-- Match the media types accepted by the new application, keeping buckets private.
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'audio/mpeg']
where id = 'chat-uploads';
update storage.buckets
set allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4'],
    file_size_limit = greatest(file_size_limit, 104857600)
where id = 'generated-images';

-- No installation identity is shipped. Configure this once using trusted SQL.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.installation_settings (
  singleton boolean primary key default true check (singleton),
  bootstrap_admin_email text not null check (position('@' in bootstrap_admin_email) > 1)
);
alter table private.installation_settings enable row level security;
revoke all on private.installation_settings from public, anon, authenticated;

create or replace function public.get_admin_email()
returns text language sql stable security definer set search_path = '' as $$
  select lower(bootstrap_admin_email) from private.installation_settings where singleton;
$$;
revoke all on function public.get_admin_email() from public, anon, authenticated;

-- The existing signup triggers use this helper; restrict execution to triggers.
alter function public.handle_new_user() set search_path = '';
alter function public.validate_invite_on_signup() set search_path = '';
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.validate_invite_on_signup() from public, anon, authenticated;
alter function public.get_user_role() set search_path = '';
alter function public.is_admin() set search_path = '';
revoke all on function public.get_user_role() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.get_user_role(), public.is_admin() to authenticated, service_role;
