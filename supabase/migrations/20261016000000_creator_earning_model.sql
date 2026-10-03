-- Creator earning provenance and integer qualified listening-hour foundation.
alter table public.creator_content_analytics_daily
  add column if not exists qualified_listening_seconds bigint not null default 0;

alter table public.creator_submissions
  add column if not exists audio_provenance text not null default 'CREATOR_SUPPLIED'
    check (audio_provenance in ('CREATOR_SUPPLIED','PLAYBOOK_AI')),
  add column if not exists earning_block_reason text;

create table if not exists public.creator_generation_entitlements (
  id uuid primary key default gen_random_uuid(),
  creator_submission_id uuid not null unique references public.creator_submissions(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  generation_job_id uuid,
  source_content_hash text,
  normalized_content_sha256 text,
  generation_scope text not null check (generation_scope in ('PERSONAL_USE','CREATOR_COMMERCIAL')),
  generation_provider text not null,
  generation_model_version text,
  generation_cost numeric,
  quoted_cost numeric,
  payment_status text not null default 'REQUIRES_PAYMENT' check (payment_status in ('NOT_REQUIRED','REQUIRES_PAYMENT','PENDING','PAID','FAILED','REFUNDED')),
  generation_status text not null default 'NOT_GENERATED' check (generation_status in ('NOT_GENERATED','PROCESSING','COMPLETED','FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playbook_audio_provenance (
  id uuid primary key default gen_random_uuid(),
  audio_sha256 text not null unique,
  owner_user_id uuid references auth.users(id) on delete set null,
  generation_job_id uuid,
  source_content_hash text,
  normalized_content_sha256 text,
  generation_scope text not null check (generation_scope in ('PERSONAL_USE','CREATOR_COMMERCIAL')),
  generation_provider text not null,
  generation_model_version text,
  payment_status text not null check (payment_status in ('NOT_REQUIRED','REQUIRES_PAYMENT','PENDING','PAID','FAILED','REFUNDED')),
  created_at timestamptz not null default now()
);
create index if not exists playbook_audio_provenance_hash_idx on public.playbook_audio_provenance(audio_sha256);

alter table public.creator_generation_entitlements enable row level security;
alter table public.playbook_audio_provenance enable row level security;
grant select on public.creator_generation_entitlements to authenticated;
grant select, insert, update on public.creator_generation_entitlements to service_role;
grant select, insert, update on public.playbook_audio_provenance to service_role;
create policy "Creators read own generation entitlement" on public.creator_generation_entitlements for select using (exists (select 1 from public.creator_profiles p where p.id = creator_generation_entitlements.creator_id and p.user_id = auth.uid()));
