-- Prevent one user from having more than one active private Library book for the same exact source bytes.
-- Deleted books remain eligible for a later upload and may reuse canonical processing by source hash.
alter table public.books add column if not exists source_sha256 text;

update public.books b
set source_sha256 = f.source_sha256
from public.book_files f
where f.book_id = b.id
  and f.user_id = b.user_id
  and f.file_type = 'SOURCE'
  and f.source_sha256 is not null
  and b.source_sha256 is null;

create index if not exists books_source_sha256_idx on public.books(user_id, source_sha256);
create unique index if not exists books_active_user_source_unique
  on public.books(user_id, source_sha256)
  where deleted_at is null and source_sha256 is not null;
