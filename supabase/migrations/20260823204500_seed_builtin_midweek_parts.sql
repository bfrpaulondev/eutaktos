begin;

create or replace function public.eutaktos_seed_builtin_midweek_parts(p_tenant_id text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if btrim(coalesce(p_tenant_id, '')) = '' then
    raise exception 'tenant id is required' using errcode = '22023';
  end if;

  insert into public.eutaktos_entities(tenant_id, entity_type, entity_id, data)
  values
    (p_tenant_id, 'midweek-part-definition', 'builtin:opening-remarks', jsonb_build_object(
      'id','builtin:opening-remarks','tenantId',p_tenant_id,'type','opening-remarks','titleKey','midweek.parts.openingRemarks',
      'durationMinutes',5,'position',1,'studentNeeded',false,'assistantRequirement','none','tenantOverrides','[]'::jsonb
    )),
    (p_tenant_id, 'midweek-part-definition', 'builtin:treasures-from-gods-word', jsonb_build_object(
      'id','builtin:treasures-from-gods-word','tenantId',p_tenant_id,'type','treasures-from-gods-word','titleKey','midweek.parts.treasuresFromGodsWord',
      'durationMinutes',10,'position',2,'studentNeeded',false,'assistantRequirement','none','tenantOverrides','[]'::jsonb
    )),
    (p_tenant_id, 'midweek-part-definition', 'builtin:apply-yourself-to-the-ministry', jsonb_build_object(
      'id','builtin:apply-yourself-to-the-ministry','tenantId',p_tenant_id,'type','apply-yourself-to-the-ministry','titleKey','midweek.parts.applyYourselfToTheMinistry',
      'durationMinutes',30,'position',3,'studentNeeded',true,'assistantRequirement','optional','tenantOverrides','[]'::jsonb
    )),
    (p_tenant_id, 'midweek-part-definition', 'builtin:living-as-christians', jsonb_build_object(
      'id','builtin:living-as-christians','tenantId',p_tenant_id,'type','living-as-christians','titleKey','midweek.parts.livingAsChristians',
      'durationMinutes',30,'position',4,'studentNeeded',true,'assistantRequirement','required','tenantOverrides','[]'::jsonb
    ))
  on conflict (tenant_id, entity_type, entity_id) do nothing;
end;
$$;

revoke all on function public.eutaktos_seed_builtin_midweek_parts(text) from public, anon, authenticated;
grant execute on function public.eutaktos_seed_builtin_midweek_parts(text) to service_role;

create or replace function public.eutaktos_seed_builtin_midweek_parts_on_person_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.entity_type = 'person' then
    perform public.eutaktos_seed_builtin_midweek_parts(new.tenant_id);
  end if;
  return new;
end;
$$;

revoke all on function public.eutaktos_seed_builtin_midweek_parts_on_person_insert() from public, anon, authenticated;

drop trigger if exists eutaktos_seed_builtin_midweek_parts_after_person on public.eutaktos_entities;
create trigger eutaktos_seed_builtin_midweek_parts_after_person
after insert on public.eutaktos_entities
for each row
when (new.entity_type = 'person')
execute function public.eutaktos_seed_builtin_midweek_parts_on_person_insert();

do $$
declare
  v_tenant_id text;
begin
  for v_tenant_id in select distinct tenant_id from public.eutaktos_entities loop
    perform public.eutaktos_seed_builtin_midweek_parts(v_tenant_id);
  end loop;
end;
$$;

commit;
