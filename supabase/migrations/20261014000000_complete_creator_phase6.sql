-- Phase 6/6.5 creator metadata, media provenance, duplicate review, and safe library removal.
alter table public.creator_submissions
  add column if not exists cover_alt_text text,
  add column if not exists short_description text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists visibility_intent text not null default 'PRIVATE' check (visibility_intent in ('PRIVATE','PUBLIC')),
  add column if not exists audio_source_type text check (audio_source_type in ('OWN_RECORDING','PROFESSIONAL_STUDIO','EXTERNAL_AI','OTHER_AUTHORIZED_SOURCE')),
  add column if not exists external_audio_provider_name text,
  add column if not exists ai_audio_disclosed_at timestamptz,
  add column if not exists audio_storage_key text,
  add column if not exists audio_sha256 text,
  add column if not exists audio_status text not null default 'NOT_PROVIDED' check (audio_status in ('NOT_PROVIDED','QUARANTINED','PROCESSING','READY','REJECTED','DUPLICATE_REVIEW')),
  add column if not exists audio_duration_seconds numeric,
  add column if not exists audio_codec text,
  add column if not exists audio_sample_rate integer,
  add column if not exists audio_channels integer,
  add column if not exists audio_rights_declaration text,
  add column if not exists audio_rights_declaration_version text,
  add column if not exists audio_rights_accepted_at timestamptz;

alter table public.catalog_content
  add column if not exists cover_alt_text text,
  add column if not exists short_description text,
  add column if not exists tags text[] not null default '{}';

alter table public.books add column if not exists deleted_at timestamptz;
create index if not exists books_active_user_created_idx on public.books(user_id, created_at desc) where deleted_at is null;
create index if not exists creator_submissions_tags_idx on public.creator_submissions using gin(tags);
create index if not exists catalog_content_tags_idx on public.catalog_content using gin(tags);

create table if not exists public.creator_duplicate_flags (
  id uuid primary key default gen_random_uuid(),
  creator_submission_id uuid not null references public.creator_submissions(id) on delete cascade,
  duplicate_type text not null check (duplicate_type in ('POTENTIAL_DUPLICATE_AUDIO','POTENTIAL_DUPLICATE_MANUSCRIPT')),
  match_type text not null check (match_type in ('EXACT_SOURCE_MATCH','EXACT_CONTENT_MATCH','EXACT_AUDIO_MATCH','LIKELY_MATCH')),
  matched_submission_id uuid references public.creator_submissions(id) on delete set null,
  requires_review boolean not null default true,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists creator_duplicate_flags_submission_idx on public.creator_duplicate_flags(creator_submission_id, requires_review);
alter table public.creator_duplicate_flags enable row level security;
grant select, insert on public.creator_duplicate_flags to service_role;
grant select on public.creator_duplicate_flags to authenticated;
create policy "Creators can read own duplicate flags" on public.creator_duplicate_flags for select using (exists (select 1 from public.creator_submissions s join public.creator_profiles p on p.id = s.creator_id where s.id = creator_duplicate_flags.creator_submission_id and p.user_id = auth.uid()));

create table if not exists public.creator_monetization_applications (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  status text not null default 'APPLIED' check (status in ('APPLIED','UNDER_REVIEW','ENABLED','SUSPENDED','DISABLED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid
);
create unique index if not exists creator_monetization_active_application_idx on public.creator_monetization_applications(creator_id) where status in ('APPLIED','UNDER_REVIEW','ENABLED','SUSPENDED');
alter table public.creator_monetization_applications enable row level security;
grant select, insert on public.creator_monetization_applications to authenticated;
grant update on public.creator_monetization_applications to service_role;
create policy "Creators can read own monetization applications" on public.creator_monetization_applications for select using (exists (select 1 from public.creator_profiles p where p.id = creator_monetization_applications.creator_id and p.user_id = auth.uid()));
create policy "Eligible creators can apply for monetization" on public.creator_monetization_applications for insert with check (exists (select 1 from public.creator_profiles p where p.id = creator_monetization_applications.creator_id and p.user_id = auth.uid() and p.status = 'ACTIVE'));

grant select, update on public.creator_submissions to authenticated;
grant select, update on public.catalog_content to authenticated;
grant select, update on public.books to authenticated;
