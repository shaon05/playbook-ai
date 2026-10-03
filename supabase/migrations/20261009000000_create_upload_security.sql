create table if not exists public.document_uploads (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade, creator_submission_id uuid references public.creator_submissions(id) on delete cascade,
  upload_context text not null check (upload_context in ('PRIVATE_LIBRARY','CREATOR_SUBMISSION')),
  original_filename text not null, declared_mime_type text not null, detected_mime_type text, file_size_bytes bigint,
  sha256 text, storage_key text not null unique,
  security_status text not null default 'QUARANTINED' check (security_status in ('QUARANTINED','SCANNING','CLEAN','REJECTED','MALICIOUS','SUSPICIOUS','SCAN_FAILED')),
  validation_status text not null default 'PENDING' check (validation_status in ('PENDING','VALID','INVALID')),
  processing_status text, incident_reference text unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((book_id is not null and upload_context = 'PRIVATE_LIBRARY') or (creator_submission_id is not null and upload_context = 'CREATOR_SUBMISSION'))
);
create table if not exists public.upload_security_events (
  id uuid primary key default gen_random_uuid(), upload_id uuid not null references public.document_uploads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, creator_id uuid, event_type text not null, severity text not null check (severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
  detected_file_type text, file_sha256 text, scanner_provider text, scanner_result_code text, reason_code text not null, safe_summary text not null,
  incident_reference text not null, created_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid
);
create table if not exists public.account_restrictions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  restriction_type text not null check (restriction_type in ('UPLOAD_BLOCKED','CREATOR_UPLOAD_BLOCKED','CREATOR_PUBLISHING_BLOCKED','ACCOUNT_SUSPENDED')),
  reason_code text not null, status text not null default 'ACTIVE' check (status in ('ACTIVE','REMOVED')),
  source_security_event_id uuid references public.upload_security_events(id) on delete set null,
  created_at timestamptz not null default now(), expires_at timestamptz, reviewed_at timestamptz, reviewed_by uuid
);
create table if not exists public.security_audit_log (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, security_event_id uuid references public.upload_security_events(id) on delete set null,
  action text not null, actor_type text not null, reason_code text not null, created_at timestamptz not null default now()
);
create index if not exists document_uploads_owner_idx on public.document_uploads(user_id, created_at desc);
create index if not exists document_uploads_status_idx on public.document_uploads(security_status, validation_status);
alter table public.document_uploads enable row level security; alter table public.upload_security_events enable row level security; alter table public.account_restrictions enable row level security; alter table public.security_audit_log enable row level security;
grant select, insert, update on public.document_uploads to authenticated;
grant select on public.upload_security_events, public.account_restrictions to authenticated;
create policy "Users can read own document uploads" on public.document_uploads for select using (auth.uid() = user_id);
create policy "Users can create own document uploads" on public.document_uploads for insert with check (auth.uid() = user_id);
create policy "Users can update own document uploads" on public.document_uploads for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can read own upload events" on public.upload_security_events for select using (auth.uid() = user_id);
create policy "Users can read own restrictions" on public.account_restrictions for select using (auth.uid() = user_id);
grant all on public.document_uploads, public.upload_security_events, public.account_restrictions, public.security_audit_log to service_role;
