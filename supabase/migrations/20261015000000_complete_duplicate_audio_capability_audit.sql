-- Complete creator duplicate-review identity and preserve independent account states.
alter table public.creator_submissions
  add column if not exists normalized_content_sha256 text,
  add column if not exists audio_fingerprint text,
  add column if not exists audio_fingerprint_status text not null default 'UNKNOWN'
    check (audio_fingerprint_status in ('AVAILABLE','UNKNOWN')),
  add column if not exists audio_match_result text not null default 'UNKNOWN'
    check (audio_match_result in ('NO_MATCH','LIKELY_MATCH','UNKNOWN'));

create index if not exists creator_submissions_normalized_content_hash_idx
  on public.creator_submissions(normalized_content_sha256);
create index if not exists creator_submissions_audio_fingerprint_idx
  on public.creator_submissions(audio_fingerprint)
  where audio_fingerprint is not null;

grant select, update on public.creator_submissions to authenticated;
