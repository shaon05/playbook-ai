alter table public.books drop constraint if exists books_status_check;
alter table public.books add constraint books_status_check check (status in ('CREATED','UPLOAD_PENDING','UPLOADED','EXTRACTION_QUEUED','EXTRACTING','OCR_REQUIRED','OCR_PROCESSING','TEXT_READY','ANALYSIS_QUEUED','ANALYZING','CHAPTERS_READY','EXTRACTION_FAILED','PROCESSING_FAILED','PROCESSING','READY','FAILED'));

alter table public.content_assets drop constraint if exists content_assets_status_check;
alter table public.content_assets add constraint content_assets_status_check check (status in ('NEW','PROCESSING','OCR_PROCESSING','TEXT_READY','OCR_REQUIRED','ANALYZING','CHAPTERS_READY','FAILED'));
alter table public.content_assets add column if not exists ocr_pipeline_version text;
alter table public.content_assets add column if not exists pages_ocrd integer;
alter table public.content_assets add column if not exists empty_pages integer;
alter table public.content_assets add column if not exists low_confidence_pages integer;
alter table public.content_assets add column if not exists average_ocr_confidence numeric(5,4);
alter table public.content_assets add column if not exists detected_language text;

create table if not exists public.content_analyses (
  id uuid primary key default gen_random_uuid(),
  content_asset_id uuid not null references public.content_assets(id) on delete cascade,
  normalized_content_sha256 text not null,
  provider text not null,
  model text not null,
  prompt_version text not null,
  pipeline_version text not null,
  status text not null check (status in ('PROCESSING','COMPLETED','FAILED')),
  document_type text,
  detected_title text,
  detected_author text,
  detected_language text,
  analysis_storage_key text,
  input_tokens bigint,
  output_tokens bigint,
  estimated_cost numeric,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index if not exists content_analyses_cache_unique on public.content_analyses(normalized_content_sha256, model, prompt_version, pipeline_version) where status = 'COMPLETED';
create index if not exists content_analyses_asset_idx on public.content_analyses(content_asset_id);

create table if not exists public.content_chapters (
  id uuid primary key default gen_random_uuid(),
  content_asset_id uuid not null references public.content_assets(id) on delete cascade,
  analysis_id uuid not null references public.content_analyses(id) on delete cascade,
  chapter_index integer not null,
  title text not null,
  start_page integer,
  end_page integer,
  text_start_offset bigint not null,
  text_end_offset bigint not null,
  word_count integer,
  estimated_listening_seconds integer,
  created_at timestamptz not null default now(),
  unique (content_asset_id, chapter_index)
);
create index if not exists content_chapters_asset_idx on public.content_chapters(content_asset_id, chapter_index);

create table if not exists public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  book_id uuid references public.books(id) on delete set null,
  content_asset_id uuid references public.content_assets(id) on delete set null,
  provider text not null,
  operation text not null,
  model text,
  input_tokens bigint,
  output_tokens bigint,
  estimated_cost numeric,
  cache_hit boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.content_analyses enable row level security;
alter table public.content_chapters enable row level security;
alter table public.usage_ledger enable row level security;
grant all on public.content_analyses, public.content_chapters, public.usage_ledger to service_role;
grant select on public.content_chapters to authenticated;
create policy "Users can read chapters for owned books" on public.content_chapters for select using (exists (select 1 from public.books where books.content_asset_id = content_chapters.content_asset_id and books.user_id = auth.uid()));
