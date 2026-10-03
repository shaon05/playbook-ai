alter table public.creator_content_analytics_daily
  add column if not exists average_completion_percent numeric(5,2) not null default 0;
