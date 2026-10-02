alter table public.books drop constraint if exists books_status_check;
alter table public.books add constraint books_status_check check (status in ('CREATED','UPLOAD_PENDING','UPLOADED','EXTRACTION_QUEUED','EXTRACTING','OCR_REQUIRED','TEXT_READY','EXTRACTION_FAILED','PROCESSING','READY','FAILED'));

create table if not exists public.processing_jobs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade, job_type text not null,
  status text not null default 'QUEUED' check (status in ('QUEUED','RUNNING','COMPLETED','FAILED')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100), attempt integer not null default 0,
  error_code text, error_message text, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz
);
create unique index if not exists processing_jobs_one_active_extraction on public.processing_jobs(book_id, job_type) where status in ('QUEUED','RUNNING');

create table if not exists public.document_extractions (
  id uuid primary key default gen_random_uuid(), book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, source_file_id uuid references public.book_files(id) on delete set null,
  status text not null, extractor text not null, extractor_version text, page_count integer not null default 0,
  pages_with_text integer not null default 0, total_characters bigint not null default 0, total_words bigint not null default 0,
  quality_score numeric(5,4), requires_ocr boolean not null default false, storage_bucket text, normalized_storage_key text,
  error_code text, error_message text, source_etag text, created_at timestamptz not null default now(), started_at timestamptz, completed_at timestamptz
);
create unique index if not exists document_extractions_completed_source on public.document_extractions(book_id, source_etag) where status = 'TEXT_READY';

create table if not exists public.document_pages (
  id uuid primary key default gen_random_uuid(), extraction_id uuid not null references public.document_extractions(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade, page_number integer not null,
  character_start bigint not null, character_end bigint not null, character_count integer not null, word_count integer not null, has_text boolean not null
);

alter table public.processing_jobs enable row level security; alter table public.document_extractions enable row level security; alter table public.document_pages enable row level security;
grant select, insert, update, delete on public.processing_jobs, public.document_extractions, public.document_pages to authenticated;
create policy "Users can read own processing jobs" on public.processing_jobs for select using (auth.uid() = user_id);
drop policy if exists "Users can insert own processing jobs" on public.processing_jobs;
create policy "Users can insert own processing jobs" on public.processing_jobs for insert with check (auth.uid() = user_id);
create policy "Users can read own extractions" on public.document_extractions for select using (auth.uid() = user_id);
create policy "Users can read own pages" on public.document_pages for select using (auth.uid() = (select user_id from public.document_extractions where id = extraction_id));
