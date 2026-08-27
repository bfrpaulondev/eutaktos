begin;

create unique index if not exists eutaktos_notification_preferences_person_idx
  on public.eutaktos_entities (tenant_id, ((data->>'personId')))
  where entity_type = 'notification-preferences';

create or replace function public.eutaktos_default_notification_preferences(
  p_tenant_id text,
  p_person_id text,
  p_updated_at timestamptz default now()
) returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if btrim(coalesce(p_tenant_id, '')) = '' or btrim(coalesce(p_person_id, '')) = '' then
    raise exception 'invalid notification preference identity' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'id', 'notification-preferences:' || p_person_id,
    'tenantId', p_tenant_id,
    'personId', p_person_id,
    'channels', jsonb_build_array(
      jsonb_build_object('channel', 'in-app', 'enabled', true, 'optedIn', true),
      jsonb_build_object('channel', 'push', 'enabled', false, 'optedIn', false),
      jsonb_build_object('channel', 'email', 'enabled', false, 'optedIn', false),
      jsonb_build_object('channel', 'whatsapp', 'enabled', false, 'optedIn', false)
    ),
    'preferredChannel', 'in-app',
    'updatedAt', to_jsonb(p_updated_at)
  );
end;
$$;

create or replace function public.eutaktos_provision_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_preference_id text;
begin
  if new.entity_type <> 'person' then
    return new;
  end if;
  if new.data->>'tenantId' <> new.tenant_id
     or new.data->>'id' <> new.entity_id then
    raise exception 'invalid person identity for notification preference provisioning' using errcode = '22023';
  end if;

  v_preference_id := 'notification-preferences:' || new.entity_id;

  insert into public.eutaktos_entities (tenant_id, entity_type, entity_id, data)
  select
    new.tenant_id,
    'notification-preferences',
    v_preference_id,
    public.eutaktos_default_notification_preferences(new.tenant_id, new.entity_id, now())
  where not exists (
    select 1
      from public.eutaktos_entities existing
     where existing.tenant_id = new.tenant_id
       and existing.entity_type = 'notification-preferences'
       and existing.data->>'personId' = new.entity_id
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.eutaktos_default_notification_preferences(text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.eutaktos_provision_notification_preferences() from public, anon, authenticated;

insert into public.eutaktos_entities (tenant_id, entity_type, entity_id, data)
select
  person.tenant_id,
  'notification-preferences',
  'notification-preferences:' || person.entity_id,
  public.eutaktos_default_notification_preferences(person.tenant_id, person.entity_id, now())
from public.eutaktos_entities person
where person.entity_type = 'person'
  and person.data->>'tenantId' = person.tenant_id
  and person.data->>'id' = person.entity_id
  and not exists (
    select 1
      from public.eutaktos_entities existing
     where existing.tenant_id = person.tenant_id
       and existing.entity_type = 'notification-preferences'
       and existing.data->>'personId' = person.entity_id
  )
on conflict do nothing;

drop trigger if exists eutaktos_person_notification_preferences on public.eutaktos_entities;
create trigger eutaktos_person_notification_preferences
after insert on public.eutaktos_entities
for each row
when (new.entity_type = 'person')
execute function public.eutaktos_provision_notification_preferences();

commit;
