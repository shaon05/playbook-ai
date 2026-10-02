alter table public.books add column if not exists content_asset_id uuid;
alter table public.book_files add column if not exists source_sha256 text;
alter table public.books drop constraint if exists books_content_asset_id_fkey;

create table if not exists public.content_assets (
  id uuid primary key default gen_random_uuid(), source_sha256 text not null, normalized_content_sha256 text,
  status text not null check (status in ('NEW','PROCESSING','TEXT_READY','OCR_REQUIRED','FAILED')),
  page_count integer, pages_with_text integer, total_characters bigint, total_words bigint, quality_score numeric(5,4),
  extraction_pipeline_version text not null, normalized_storage_key text, error_code text, error_message text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists content_assets_source_version_unique on public.content_assets(source_sha256, extraction_pipeline_version);
create index if not exists content_assets_normalized_hash_idx on public.content_assets(normalized_content_sha256);
alter table public.books add constraint books_content_asset_id_fkey foreign key (content_asset_id) references public.content_assets(id) on delete set null;
alter table public.document_extractions add column if not exists content_asset_id uuid references public.content_assets(id) on delete set null;
alter table public.document_extractions add column if not exists normalized_content_sha256 text;
alter table public.content_assets enable row level security;
grant select, insert, update, delete on public.content_assets to service_role;
create policy "No direct content asset access" on public.content_assets for all using (false) with check (false);
