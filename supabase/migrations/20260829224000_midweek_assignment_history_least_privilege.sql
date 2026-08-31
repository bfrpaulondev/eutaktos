begin;

revoke all on table public.eutaktos_assignment_history from service_role;
grant select, insert on table public.eutaktos_assignment_history to service_role;

commit;
