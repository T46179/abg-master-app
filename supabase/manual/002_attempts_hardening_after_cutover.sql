begin;

revoke all on table public.attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.attempts to service_role;

commit;
