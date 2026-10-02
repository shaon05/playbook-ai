create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text,
  status text not null default 'CREATED' check (status in ('CREATED', 'UPLOAD_PENDING', 'UPLOADED', 'UPLOAD_FAILED', 'PROCESSING', 'READY', 'FAILED')),
  original_filename text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.book_files (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_type text not null check (file_type in ('SOURCE')),
  storage_provider text not null check (storage_provider in ('S3')),
  storage_bucket text not null,
  storage_key text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  etag text,
  created_at timestamptz not null default now()
);

alter table public.books enable row level security;
alter table public.book_files enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.books to authenticated;
grant select, insert, update, delete on public.book_files to authenticated;

drop policy if exists "Users can read their own books" on public.books;
create policy "Users can read their own books" on public.books for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own books" on public.books;
create policy "Users can insert their own books" on public.books for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own books" on public.books;
create policy "Users can update their own books" on public.books for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own books" on public.books;
create policy "Users can delete their own books" on public.books for delete using (auth.uid() = user_id);

drop policy if exists "Users can read their own book files" on public.book_files;
create policy "Users can read their own book files" on public.book_files for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their own book files" on public.book_files;
create policy "Users can insert their own book files" on public.book_files for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their own book files" on public.book_files;
create policy "Users can update their own book files" on public.book_files for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own book files" on public.book_files;
create policy "Users can delete their own book files" on public.book_files for delete using (auth.uid() = user_id);

create or replace function public.set_books_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at before update on public.books for each row execute procedure public.set_books_updated_at();
