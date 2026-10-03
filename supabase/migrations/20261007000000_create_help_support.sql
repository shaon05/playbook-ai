create table if not exists public.help_articles (
  id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null,
  category text not null, body text not null, audience text not null default 'ALL' check (audience in ('ALL','LISTENER','CREATOR')),
  is_published boolean not null default false, updated_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  creator_id uuid references public.creator_profiles(id) on delete set null, category text not null,
  subject text not null, status text not null default 'OPEN' check (status in ('OPEN','IN_PROGRESS','WAITING_FOR_USER','RESOLVED','CLOSED')),
  priority text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH','URGENT')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), resolved_at timestamptz
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_type text not null check (sender_type in ('USER','SUPPORT')), sender_user_id uuid references auth.users(id) on delete set null,
  message text not null, attachment_storage_key text, created_at timestamptz not null default now()
);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(), reporter_user_id uuid references auth.users(id) on delete set null,
  catalog_content_id uuid, creator_id uuid references public.creator_profiles(id) on delete set null,
  reason text not null check (reason in ('COPYRIGHT','SPAM','HARASSMENT','INAPPROPRIATE','MISLEADING','OTHER')),
  details text, status text not null default 'OPEN' check (status in ('OPEN','IN_REVIEW','RESOLVED','DISMISSED')),
  created_at timestamptz not null default now(), reviewed_at timestamptz
);

alter table public.help_articles enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.content_reports enable row level security;

grant select on public.help_articles to anon, authenticated;
grant select, insert, update on public.support_tickets to authenticated;
grant select, insert on public.support_messages to authenticated;
grant insert on public.content_reports to anon, authenticated;

drop policy if exists "Anyone can read published help" on public.help_articles;
drop policy if exists "Users can read their tickets" on public.support_tickets;
drop policy if exists "Users can create their tickets" on public.support_tickets;
drop policy if exists "Users can update their tickets" on public.support_tickets;
drop policy if exists "Users can read their messages" on public.support_messages;
drop policy if exists "Users can create their messages" on public.support_messages;
drop policy if exists "Anyone can submit content reports" on public.content_reports;

create policy "Anyone can read published help" on public.help_articles for select using (is_published = true);
create policy "Users can read their tickets" on public.support_tickets for select using (auth.uid() = user_id);
create policy "Users can create their tickets" on public.support_tickets for insert with check (auth.uid() = user_id);
create policy "Users can update their tickets" on public.support_tickets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can read their messages" on public.support_messages for select using (exists (select 1 from public.support_tickets where support_tickets.id = support_messages.ticket_id and support_tickets.user_id = auth.uid()));
create policy "Users can create their messages" on public.support_messages for insert with check (sender_type = 'USER' and sender_user_id = auth.uid() and exists (select 1 from public.support_tickets where support_tickets.id = support_messages.ticket_id and support_tickets.user_id = auth.uid()));
create policy "Anyone can submit content reports" on public.content_reports for insert with check (reporter_user_id is null or reporter_user_id = auth.uid());

insert into public.help_articles (slug, title, category, body, audience, is_published) values
('getting-started', 'Getting Started', 'Getting Started', 'Learn how to discover stories, save your library, and start listening.', 'ALL', true),
('account-login', 'Account & Login', 'Account & Login', 'Your PlayBook account keeps your library and listening progress available across devices.', 'ALL', true),
('uploading-pdfs', 'Uploading PDFs', 'Uploading PDFs', 'Private PDF uploads are available to signed-in users and remain private to your account.', 'LISTENER', true),
('listening-progress', 'Library & Progress', 'Library & Progress', 'Your saved books and listening progress are linked to your account.', 'LISTENER', true),
('privacy-security', 'Privacy & Security', 'Privacy & Security', 'We keep private documents private and never ask support users to share passwords or access tokens.', 'ALL', true),
('publishing-stories', 'Publishing Stories', 'Publishing Stories', 'Creator publishing is a separate workflow with rights review and moderation.', 'CREATOR', true),
('copyright-rights', 'Copyright & Rights', 'Copyright & Rights', 'Copyright complaints and takedown requests are reviewed by people.', 'ALL', true)
on conflict (slug) do update set title = excluded.title, category = excluded.category, body = excluded.body, audience = excluded.audience, is_published = excluded.is_published;
