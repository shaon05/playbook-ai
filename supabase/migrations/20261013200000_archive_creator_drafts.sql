-- Preserve unpublished creator records and their security/audit references.
-- Archived drafts are hidden by the API rather than physically deleted.
alter table public.creator_submissions
  add column if not exists archived_at timestamptz;

create index if not exists creator_submissions_active_creator_updated_idx
  on public.creator_submissions (creator_id, updated_at desc)
  where archived_at is null;
