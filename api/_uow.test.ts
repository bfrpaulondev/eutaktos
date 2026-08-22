import { describe, expect, it, vi } from 'vitest';
import { createAccessContext } from '@eutaktos/domain';
import type { SupabaseRestDatabase } from './_db';
import { PeopleSnapshotUnitOfWork } from './_uow';

const person={id:'p1',tenantId:'tenant-a',displayName:'Test Person',preferredLocale:'pt-PT',active:true,availability:[],eligibility:[],emergencyContacts:[]} as const;
const row={tenant_id:'tenant-a',entity_type:'person',entity_id:'p1',data:person,version:3} as const;
const context=createAccessContext({tenantId:'tenant-a',actorId:'admin',capabilities:['people.read','people.write']});

describe('snapshot unit of work',()=>{
  it('rejects a stored row whose JSON tenant does not match its tenant column',()=>{
    expect(()=>new PeopleSnapshotUnitOfWork('tenant-a',[{...row,data:{...person,tenantId:'tenant-b'}}])).toThrow('Invalid stored entity identity');
  });
  it('rejects callers from another tenant even when entity ids collide',()=>{
    const uow=new PeopleSnapshotUnitOfWork('tenant-a',[row]);
    const other=createAccessContext({tenantId:'tenant-b',actorId:'admin',capabilities:['people.read']});
    expect(()=>uow.findById(other,'p1')).toThrow('Cross-tenant access denied');
  });
  it('flushes an update through exactly one atomic RPC with the observed version',async()=>{
    const uow=new PeopleSnapshotUnitOfWork('tenant-a',[row]);
    const changed={...person,displayName:'Updated Person'};
    uow.commitUpdate(context,{
      person:changed,
      auditEvent:{id:'audit-1',tenantId:'tenant-a',resourceType:'person',resourceId:'p1',action:'update',actorId:'admin',occurredAt:'2026-08-22T15:00:00.000Z',changedFields:['displayName']},
      domainEvent:{id:'event-1',tenantId:'tenant-a',type:'PersonUpdated',aggregateId:'p1',actorId:'admin',occurredAt:'2026-08-22T15:00:00.000Z',schemaVersion:1},
    });
    const applyEntityChange=vi.fn(async()=>undefined);
    await uow.flush({applyEntityChange} as unknown as SupabaseRestDatabase);
    expect(applyEntityChange).toHaveBeenCalledTimes(1);
    expect(applyEntityChange.mock.calls[0]?.[0]).toMatchObject({p_tenant_id:'tenant-a',p_entity_id:'p1',p_expected_version:3});
  });
});
