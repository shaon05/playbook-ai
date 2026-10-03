alter table public.profiles add column if not exists subscription_plan text not null default 'FREE' check (subscription_plan in ('FREE','PREMIUM'));

create table if not exists public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  bio text,
  primary_language text,
  status text not null default 'PENDING' check (status in ('PENDING','ACTIVE','SUSPENDED')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.creator_profiles enable row level security;
grant select on public.creator_profiles to anon, authenticated;
grant insert, update, delete on public.creator_profiles to authenticated;
create policy "Public can read active creator profiles" on public.creator_profiles for select using (status = 'ACTIVE' or auth.uid() = user_id);
create policy "Users can create their creator profile" on public.creator_profiles for insert with check (auth.uid() = user_id);
create policy "Users can update their creator profile" on public.creator_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their creator profile" on public.creator_profiles for delete using (auth.uid() = user_id);

create or replace function public.set_creator_profiles_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists creator_profiles_set_updated_at on public.creator_profiles;
create trigger creator_profiles_set_updated_at before update on public.creator_profiles for each row execute procedure public.set_creator_profiles_updated_at();
