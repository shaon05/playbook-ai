alter table public.processing_jobs add column if not exists lease_expires_at timestamptz;
create index if not exists processing_jobs_claim_idx on public.processing_jobs(job_type, status, lease_expires_at, created_at);

create or replace function public.claim_next_processing_job(p_job_type text)
returns table (id uuid, user_id uuid, book_id uuid, creator_submission_id uuid, attempt integer)
language plpgsql security definer set search_path = public
as $$
begin
  return query
  with next_job as (
    select j.id from public.processing_jobs j
    where j.job_type = p_job_type and (j.status = 'QUEUED' or (j.status = 'RUNNING' and j.lease_expires_at < now()))
    order by j.created_at asc for update skip locked limit 1
  )
  update public.processing_jobs j
  set status = 'RUNNING', progress_percent = greatest(j.progress_percent, 5), attempt = j.attempt + 1,
      started_at = coalesce(j.started_at, now()), lease_expires_at = now() + interval '15 minutes'
  from next_job where j.id = next_job.id
  returning j.id, j.user_id, j.book_id, j.creator_submission_id, j.attempt;
end;
$$;
revoke all on function public.claim_next_processing_job(text) from public;
grant execute on function public.claim_next_processing_job(text) to service_role;

create table if not exists public.api_rate_limit_windows (
  user_id uuid not null references auth.users(id) on delete cascade, scope text not null,
  window_started_at timestamptz not null, request_count integer not null default 0,
  primary key (user_id, scope, window_started_at)
);
alter table public.api_rate_limit_windows enable row level security;
revoke all on public.api_rate_limit_windows from anon, authenticated;
grant select, insert, update, delete on public.api_rate_limit_windows to service_role;

create or replace function public.consume_api_rate_limit(p_user_id uuid, p_scope text, p_limit integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public
as $$
declare
  current_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  next_count integer;
begin
  insert into public.api_rate_limit_windows(user_id, scope, window_started_at, request_count)
  values (p_user_id, p_scope, current_window, 1)
  on conflict (user_id, scope, window_started_at)
  do update set request_count = api_rate_limit_windows.request_count + 1
  returning request_count into next_count;
  delete from public.api_rate_limit_windows where window_started_at < current_window - make_interval(secs => p_window_seconds);
  return next_count <= p_limit;
end;
$$;
revoke all on function public.consume_api_rate_limit(uuid, text, integer, integer) from public;
grant execute on function public.consume_api_rate_limit(uuid, text, integer, integer) to service_role;
