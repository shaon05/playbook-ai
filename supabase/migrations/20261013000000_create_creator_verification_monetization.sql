create table if not exists public.creator_verifications (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null unique references public.creator_profiles(id) on delete cascade,
  status text not null default 'NOT_APPLIED' check (status in ('NOT_APPLIED','APPLIED','UNDER_REVIEW','VERIFIED','REJECTED','REVOKED')),
  application_reason text, submitted_at timestamptz, reviewed_at timestamptz, reviewed_by uuid references auth.users(id) on delete set null,
  creator_visible_message text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.creator_guideline_acceptances (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  guideline_version text not null, accepted_at timestamptz not null default now(), unique (creator_id, guideline_version)
);
create table if not exists public.creator_monetization_profiles (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null unique references public.creator_profiles(id) on delete cascade,
  status text not null default 'NOT_ELIGIBLE' check (status in ('NOT_ELIGIBLE','ELIGIBLE','APPLIED','UNDER_REVIEW','ENABLED','SUSPENDED','DISABLED')),
  standing text not null default 'GOOD_STANDING' check (standing in ('GOOD_STANDING','LIMITED','SUSPENDED')),
  applied_at timestamptz, reviewed_at timestamptz, reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.creator_verifications enable row level security;
alter table public.creator_guideline_acceptances enable row level security;
alter table public.creator_monetization_profiles enable row level security;
grant select, insert on public.creator_verifications, public.creator_guideline_acceptances, public.creator_monetization_profiles to authenticated;
create policy "Creators read own verification" on public.creator_verifications for select using (exists (select 1 from public.creator_profiles p where p.id=creator_verifications.creator_id and p.user_id=auth.uid()));
create policy "Creators apply verification" on public.creator_verifications for insert with check (exists (select 1 from public.creator_profiles p where p.id=creator_verifications.creator_id and p.user_id=auth.uid()));
create policy "Creators read own guideline acceptance" on public.creator_guideline_acceptances for select using (exists (select 1 from public.creator_profiles p where p.id=creator_guideline_acceptances.creator_id and p.user_id=auth.uid()));
create policy "Creators accept guidelines" on public.creator_guideline_acceptances for insert with check (exists (select 1 from public.creator_profiles p where p.id=creator_guideline_acceptances.creator_id and p.user_id=auth.uid()));
create policy "Creators read own monetization" on public.creator_monetization_profiles for select using (exists (select 1 from public.creator_profiles p where p.id=creator_monetization_profiles.creator_id and p.user_id=auth.uid()));
