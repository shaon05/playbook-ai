create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null unique references public.books(id) on delete cascade,
  context text not null default 'PRIVATE_LIBRARY' check (context in ('PRIVATE_LIBRARY')),
  status text not null default 'DRAFT' check (status in ('DRAFT','UPLOADING','READY','PROCESSING','FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_input_pages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  upload_id uuid references public.document_uploads(id) on delete set null,
  page_index integer not null check (page_index >= 0),
  security_status text not null default 'QUARANTINED' check (security_status in ('QUARANTINED','SCANNING','CLEAN','REJECTED','MALICIOUS','SUSPICIOUS','SCAN_FAILED')),
  validation_status text not null default 'PENDING' check (validation_status in ('PENDING','VALID','INVALID')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, page_index)
);

alter table public.document_uploads add column if not exists document_id uuid references public.documents(id) on delete cascade;
alter table public.document_uploads add column if not exists input_page_id uuid references public.document_input_pages(id) on delete set null;
alter table public.documents enable row level security;
alter table public.document_input_pages enable row level security;
grant select, insert, update on public.documents to authenticated;
grant select, insert, update on public.document_input_pages to authenticated;
create policy "Users can manage their documents" on public.documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage their input pages" on public.document_input_pages for all using (exists (select 1 from public.documents where documents.id = document_input_pages.document_id and documents.user_id = auth.uid())) with check (exists (select 1 from public.documents where documents.id = document_input_pages.document_id and documents.user_id = auth.uid()));
create index if not exists document_input_pages_order_idx on public.document_input_pages(document_id, page_index);
