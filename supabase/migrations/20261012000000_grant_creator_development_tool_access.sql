-- Server-only privileges for the development creator approval/status CLI.
-- This does not grant any access to anon/authenticated mobile clients.
grant usage on schema public to service_role;
grant select, update on public.creator_profiles to service_role;
grant select, insert on public.security_audit_log to service_role;
