grant select on public.creator_verifications to anon, authenticated;

drop policy if exists "Public can read verified creator badge" on public.creator_verifications;
create policy "Public can read verified creator badge"
  on public.creator_verifications
  for select
  using (status = 'VERIFIED');
