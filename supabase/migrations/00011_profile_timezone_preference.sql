alter table public.profiles
add column if not exists timezone_preference text not null default 'America/New_York';
