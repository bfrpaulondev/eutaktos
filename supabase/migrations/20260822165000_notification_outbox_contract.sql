begin;

create or replace function public.eutaktos_claim_notification_outbox(
  p_limit integer default 25
) returns table(
  tenant_id text,
  id text,
  event_type text,
  aggregate_id text,
  actor_id text,
  occurred_at timestamptz,
  schema_version integer,
  correlation_id text,
  payload jsonb,
  delivery_attempts integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'invalid outbox batch size' using errcode = '22023';
  end if;

  return query
  with claimed as (
    select o.tenant_id, o.id
      from public.eutaktos_outbox o
     where o.delivered_at is null
       and o.delivery_attempts < 10
       and o.event_type = 'NotificationIntentQueued'
     order by o.occurred_at, o.id
     limit p_limit
     for update skip locked
  ), updated as (
    update public.eutaktos_outbox o
       set delivery_attempts = o.delivery_attempts + 1,
           last_delivery_error = null
      from claimed c
     where o.tenant_id = c.tenant_id and o.id = c.id
    returning o.*
  )
  select u.tenant_id,u.id,u.event_type,u.aggregate_id,u.actor_id,u.occurred_at,u.schema_version,u.correlation_id,u.payload,u.delivery_attempts
    from updated u
   order by u.occurred_at,u.id;
end;
$$;

revoke all on function public.eutaktos_claim_notification_outbox(integer) from public, anon, authenticated;
grant execute on function public.eutaktos_claim_notification_outbox(integer) to service_role;

commit;
