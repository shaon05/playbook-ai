-- Neutral creator review signals and publication decision state.
alter table public.creator_submissions
  add column if not exists review_status text not null default 'NOT_STARTED'
    check (review_status in ('NOT_STARTED','PROCESSING','PASS','REQUIRES_REVIEW','BLOCKED')),
  add column if not exists review_version text,
  add column if not exists review_completed_at timestamptz,
  add column if not exists creator_visible_review_message text;

create table if not exists public.creator_review_signals (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.creator_submissions(id) on delete cascade,
  content_id uuid references public.catalog_content(id) on delete set null,
  signal_type text not null,
  signal_source text not null check (signal_source in ('DETERMINISTIC','TEXT_SIMILARITY','AUDIO_FINGERPRINT','PROVENANCE','AI','SECURITY','HUMAN')),
  severity text not null check (severity in ('LOW','MEDIUM','HIGH')),
  confidence numeric(5,4),
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED','DISMISSED')),
  metadata_json jsonb not null default '{}'::jsonb,
  provider text,
  provider_version text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);
create index if not exists creator_review_signals_submission_idx on public.creator_review_signals(submission_id, status, severity);
alter table public.creator_review_signals enable row level security;
grant select on public.creator_review_signals to authenticated;
grant select, insert, update on public.creator_review_signals to service_role;
create policy "Creators read own safe review signals" on public.creator_review_signals for select using (exists (select 1 from public.creator_submissions s join public.creator_profiles p on p.id = s.creator_id where s.id = creator_review_signals.submission_id and p.user_id = auth.uid()));

create or replace function public.reset_creator_review_on_material_edit()
returns trigger language plpgsql as $$
begin
  if new.title is distinct from old.title
    or new.short_description is distinct from old.short_description
    or new.description is distinct from old.description
    or new.language is distinct from old.language
    or new.tags is distinct from old.tags
    or new.source_storage_key is distinct from old.source_storage_key
    or new.source_sha256 is distinct from old.source_sha256
    or new.normalized_content_sha256 is distinct from old.normalized_content_sha256
    or new.audio_sha256 is distinct from old.audio_sha256
    or new.audio_fingerprint is distinct from old.audio_fingerprint
  then
    new.review_status := 'PROCESSING';
    new.review_completed_at := null;
    new.creator_visible_review_message := null;
  end if;
  return new;
end;
$$;

drop trigger if exists creator_review_reset_on_material_edit on public.creator_submissions;
create trigger creator_review_reset_on_material_edit
before update on public.creator_submissions
for each row execute procedure public.reset_creator_review_on_material_edit();

create or replace function public.record_creator_audio_review_signal()
returns trigger language plpgsql as $$
begin
  if new.audio_status = 'DUPLICATE_REVIEW' and new.audio_status is distinct from old.audio_status then
    insert into public.creator_review_signals (submission_id, signal_type, signal_source, severity, confidence, metadata_json)
    select new.id, 'AUDIO_DUPLICATE_REVIEW', 'AUDIO_FINGERPRINT', 'MEDIUM',
      case when new.audio_match_result = 'LIKELY_MATCH' then 0.8 else 1.0 end,
      jsonb_build_object('matchResult', coalesce(new.audio_match_result, 'UNKNOWN'), 'rightsReviewRequired', new.earning_block_reason is not null)
    where not exists (
      select 1 from public.creator_review_signals
      where submission_id = new.id and signal_type = 'AUDIO_DUPLICATE_REVIEW' and status = 'OPEN'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists creator_audio_review_signal on public.creator_submissions;
create trigger creator_audio_review_signal
after update on public.creator_submissions
for each row execute procedure public.record_creator_audio_review_signal();

create or replace function public.apply_creator_human_review_decision()
returns trigger language plpgsql as $$
begin
  update public.creator_submissions
  set review_status = case
    when new.decision = 'APPROVED' then 'PASS'
    when new.decision in ('REJECTED', 'UNPUBLISHED') then 'BLOCKED'
    else 'REQUIRES_REVIEW'
  end,
  review_version = coalesce(review_version, 'human-v1'),
  review_completed_at = now(),
  creator_visible_review_message = new.creator_visible_message
  where id = new.submission_id;

  if new.decision = 'APPROVED' then
    update public.creator_review_signals
    set status = 'RESOLVED', resolved_at = now(), resolved_by = new.reviewed_by
    where submission_id = new.submission_id and status = 'OPEN';
  end if;
  return new;
end;
$$;

drop trigger if exists creator_human_review_decision on public.creator_moderation_reviews;
create trigger creator_human_review_decision
after insert on public.creator_moderation_reviews
for each row execute procedure public.apply_creator_human_review_decision();
