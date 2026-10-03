alter table public.creator_submissions drop constraint if exists creator_submissions_status_check;
alter table public.creator_submissions add constraint creator_submissions_status_check check (status in ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','PROCESSING','READY_FOR_CREATOR_REVIEW','PUBLISHED','CHANGES_REQUESTED','REJECTED','PROCESSING_FAILED','UNPUBLISHED'));

create table if not exists public.creator_rights_declarations (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null unique references public.creator_submissions(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade, declaration_version text not null,
  declaration_text text not null, accepted_at timestamptz not null default now()
);
create table if not exists public.creator_moderation_reviews (
  id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.creator_submissions(id) on delete cascade,
  reviewed_by uuid, decision text not null check (decision in ('APPROVED','CHANGES_REQUESTED','REJECTED','UNPUBLISHED')),
  internal_notes text, creator_visible_message text, reviewed_at timestamptz not null default now()
);
create table if not exists public.submission_genres (
  submission_id uuid not null references public.creator_submissions(id) on delete cascade, genre_id uuid not null references public.genres(id) on delete cascade,
  primary key (submission_id, genre_id)
);
alter table public.catalog_content add column if not exists audio_status text not null default 'NOT_GENERATED';
alter table public.catalog_content drop constraint if exists catalog_content_audio_status_check;
alter table public.catalog_content add constraint catalog_content_audio_status_check check (audio_status in ('NOT_GENERATED','QUEUED','GENERATING','READY','FAILED'));
alter table public.creator_rights_declarations enable row level security;
alter table public.creator_moderation_reviews enable row level security;
alter table public.submission_genres enable row level security;
grant select, insert, update on public.creator_rights_declarations, public.submission_genres to authenticated;
grant select on public.creator_moderation_reviews to authenticated;
create policy "Creators can manage own rights declarations" on public.creator_rights_declarations for all using (exists (select 1 from public.creator_submissions s join public.creator_profiles p on p.id=s.creator_id where s.id=creator_rights_declarations.submission_id and p.user_id=auth.uid())) with check (exists (select 1 from public.creator_submissions s join public.creator_profiles p on p.id=s.creator_id where s.id=creator_rights_declarations.submission_id and p.user_id=auth.uid()));
create policy "Creators can read own moderation messages" on public.creator_moderation_reviews for select using (exists (select 1 from public.creator_submissions s join public.creator_profiles p on p.id=s.creator_id where s.id=creator_moderation_reviews.submission_id and p.user_id=auth.uid()));
create policy "Creators can manage own submission genres" on public.submission_genres for all using (exists (select 1 from public.creator_submissions s join public.creator_profiles p on p.id=s.creator_id where s.id=submission_genres.submission_id and p.user_id=auth.uid())) with check (exists (select 1 from public.creator_submissions s join public.creator_profiles p on p.id=s.creator_id where s.id=submission_genres.submission_id and p.user_id=auth.uid()));
create policy "Creators can update own submissions" on public.creator_submissions for update using (exists (select 1 from public.creator_profiles p where p.id=creator_submissions.creator_id and p.user_id=auth.uid())) with check (exists (select 1 from public.creator_profiles p where p.id=creator_submissions.creator_id and p.user_id=auth.uid()));
grant update on public.catalog_content to authenticated;
create policy "Creators can publish own ready content" on public.catalog_content for update using (exists (select 1 from public.creator_profiles p where p.id=catalog_content.creator_id and p.user_id=auth.uid()) and status in ('READY','PUBLISHED','UNPUBLISHED')) with check (exists (select 1 from public.creator_profiles p where p.id=catalog_content.creator_id and p.user_id=auth.uid()));
