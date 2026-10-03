grant update on public.creator_verifications to authenticated;
create policy "Creators reapply verification" on public.creator_verifications for update
using (exists (select 1 from public.creator_profiles p where p.id = creator_verifications.creator_id and p.user_id = auth.uid()) and status in ('NOT_APPLIED','REJECTED','REVOKED'))
with check (
  status = 'APPLIED'
  and creator_id in (select id from public.creator_profiles where user_id = auth.uid() and status = 'ACTIVE')
  and reviewed_by is null
  and reviewed_at is null
);
