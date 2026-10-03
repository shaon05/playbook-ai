create table if not exists public.genres (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  is_active boolean not null default true, sort_order integer not null default 0
);

create table if not exists public.creator_submissions (
  id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  title text not null, description text, language text, source_storage_key text, cover_storage_key text,
  rights_declaration text not null, status text not null default 'SUBMITTED' check (status in ('SUBMITTED','UNDER_REVIEW','APPROVED','PROCESSING','READY_FOR_CREATOR_REVIEW','PUBLISHED','REJECTED','UNPUBLISHED')),
  creator_review_state text not null default 'PENDING' check (creator_review_state in ('PENDING','CONFIRMED','DECLINED')),
  moderation_notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.catalog_content (
  id uuid primary key default gen_random_uuid(), content_asset_id uuid references public.content_assets(id) on delete set null,
  creator_id uuid references public.creator_profiles(id) on delete set null, creator_submission_id uuid unique references public.creator_submissions(id) on delete set null,
  title text not null, author_display_name text, description text, content_type text not null check (content_type in ('STORY','BOOK','ARTICLE','PODCAST','OTHER')),
  language text, status text not null default 'DRAFT' check (status in ('DRAFT','UNDER_REVIEW','APPROVED','PROCESSING','READY','PUBLISHED','REJECTED','UNPUBLISHED')),
  visibility text not null default 'PRIVATE' check (visibility in ('PRIVATE','UNLISTED','PUBLIC')), cover_storage_key text,
  estimated_duration_seconds integer, published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists catalog_public_idx on public.catalog_content(status, visibility, published_at desc);
create index if not exists catalog_search_idx on public.catalog_content using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(author_display_name,'') || ' ' || coalesce(description,'')));

create table if not exists public.content_genres (
  catalog_content_id uuid not null references public.catalog_content(id) on delete cascade, genre_id uuid not null references public.genres(id) on delete cascade,
  primary key (catalog_content_id, genre_id)
);

create table if not exists public.creator_follows (
  follower_user_id uuid not null references auth.users(id) on delete cascade, creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (follower_user_id, creator_id)
);

create table if not exists public.user_catalog_favorites (
  user_id uuid not null references auth.users(id) on delete cascade, catalog_content_id uuid not null references public.catalog_content(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (user_id, catalog_content_id)
);

create table if not exists public.listening_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, anonymous_session_id text,
  catalog_content_id uuid not null references public.catalog_content(id) on delete cascade, started_at timestamptz not null default now(), last_activity_at timestamptz not null default now(),
  completed_at timestamptz, listening_seconds integer not null default 0, max_progress_percent numeric(5,2) not null default 0,
  qualified boolean not null default false, completed boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (user_id is not null or anonymous_session_id is not null)
);

create table if not exists public.user_content_events (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, anonymous_session_id text,
  catalog_content_id uuid not null references public.catalog_content(id) on delete cascade, session_id uuid references public.listening_sessions(id) on delete set null,
  event_type text not null check (event_type in ('IMPRESSION','OPEN','PLAY_START','QUALIFIED_LISTEN','COMPLETE','FAVORITE','UNFAVORITE','SHARE','FOLLOW_CREATOR','UNFOLLOW_CREATOR')),
  idempotency_key text, created_at timestamptz not null default now(), unique (user_id, idempotency_key), check (user_id is not null or anonymous_session_id is not null)
);

create table if not exists public.creator_content_analytics_daily (
  date date not null, creator_id uuid not null references public.creator_profiles(id) on delete cascade, catalog_content_id uuid not null references public.catalog_content(id) on delete cascade,
  impressions bigint not null default 0, opens bigint not null default 0, play_starts bigint not null default 0, qualified_listens bigint not null default 0,
  unique_listeners bigint not null default 0, listening_seconds bigint not null default 0, completions bigint not null default 0, favorites_added bigint not null default 0,
  shares bigint not null default 0, followers_gained bigint not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (date, creator_id, catalog_content_id)
);

alter table public.genres enable row level security; alter table public.catalog_content enable row level security; alter table public.content_genres enable row level security;
alter table public.creator_submissions enable row level security; alter table public.creator_follows enable row level security; alter table public.user_catalog_favorites enable row level security;
alter table public.listening_sessions enable row level security; alter table public.user_content_events enable row level security; alter table public.creator_content_analytics_daily enable row level security;

grant select on public.genres, public.catalog_content, public.content_genres to anon, authenticated;
grant select, insert, delete on public.creator_follows, public.user_catalog_favorites to authenticated;
grant select, insert, update on public.listening_sessions, public.user_content_events to authenticated;
grant select, insert, update on public.creator_submissions to authenticated;
grant select on public.creator_content_analytics_daily to authenticated;

create policy "Public can read active genres" on public.genres for select using (is_active = true);
create policy "Public can read published catalog" on public.catalog_content for select using (status = 'PUBLISHED' and visibility = 'PUBLIC');
create policy "Public can read genres for published catalog" on public.content_genres for select using (exists (select 1 from public.catalog_content where catalog_content.id = content_genres.catalog_content_id and catalog_content.status = 'PUBLISHED' and catalog_content.visibility = 'PUBLIC'));
create policy "Creators can manage own submissions" on public.creator_submissions for select using (exists (select 1 from public.creator_profiles where creator_profiles.id = creator_submissions.creator_id and creator_profiles.user_id = auth.uid()));
create policy "Active creators can create submissions" on public.creator_submissions for insert with check (exists (select 1 from public.creator_profiles where creator_profiles.id = creator_submissions.creator_id and creator_profiles.user_id = auth.uid() and creator_profiles.status = 'ACTIVE'));
create policy "Users can manage own follows" on public.creator_follows for all using (auth.uid() = follower_user_id) with check (auth.uid() = follower_user_id);
create policy "Users can manage own favorites" on public.user_catalog_favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can read own sessions" on public.listening_sessions for select using (auth.uid() = user_id);
create policy "Users can create own sessions" on public.listening_sessions for insert with check (auth.uid() = user_id);
create policy "Users can update own sessions" on public.listening_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can read own events" on public.user_content_events for select using (auth.uid() = user_id);
create policy "Users can create own events" on public.user_content_events for insert with check (auth.uid() = user_id);
create policy "Creators can read own daily analytics" on public.creator_content_analytics_daily for select using (exists (select 1 from public.creator_profiles where creator_profiles.id = creator_content_analytics_daily.creator_id and creator_profiles.user_id = auth.uid() and creator_profiles.status = 'ACTIVE'));

insert into public.genres (name, slug, sort_order) values
('Horror','horror',1),('Romance','romance',2),('Mystery','mystery',3),('Thriller','thriller',4),('Fantasy','fantasy',5),('Science Fiction','science-fiction',6),('Adventure','adventure',7),('Crime','crime',8),('Comedy','comedy',9),('History','history',10),('Biography','biography',11),('Self Growth','self-growth',12),('Business','business',13),('Education','education',14),('Short Stories','short-stories',15)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order;
