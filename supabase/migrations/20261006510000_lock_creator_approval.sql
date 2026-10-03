create or replace function public.prevent_self_creator_approval()
returns trigger language plpgsql as $$
begin
  if current_user <> 'service_role' and old.status is distinct from new.status then
    raise exception 'creator status is controlled by approval workflow';
  end if;
  return new;
end;
$$;
drop trigger if exists creator_profiles_approval_guard on public.creator_profiles;
create trigger creator_profiles_approval_guard before update on public.creator_profiles for each row execute procedure public.prevent_self_creator_approval();
