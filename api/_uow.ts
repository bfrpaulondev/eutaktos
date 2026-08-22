import type {
  AccessContext,
  AccessGrant,
  CongregationPerson,
  Household,
  ResponsibilityAssignment,
  ServiceGroup,
} from '@eutaktos/domain';
import type {
  AccessGrantChange,
  AccessGrantRuntime,
  AccessGrantUnitOfWork,
  ApplicationIdScope,
  ApplicationRuntime,
  HouseholdChange,
  HouseholdUnitOfWork,
  OrganizationDeletionChange,
  PeopleUnitOfWork,
  PersonChange,
  ResponsibilityChange,
  ResponsibilityUnitOfWork,
  ServiceGroupChange,
  ServiceGroupUnitOfWork,
} from '@eutaktos/application';
import type { AccessGrantRow, EntityRow } from './_db';
import { SupabaseRestDatabase } from './_db';

type TenantEntity = { id: string; tenantId: string };

type PendingEntityChange =
  | { kind: 'upsert'; entityType: string; entityId: string; data: TenantEntity; expectedVersion: number | null; auditEvent: unknown; domainEvent: unknown }
  | { kind: 'delete'; entityType: string; entityId: string; expectedVersion: number; auditEvent: unknown; domainEvent: unknown };

type PendingGrantChange = { grant: Readonly<AccessGrant>; auditEvent: unknown; domainEvent: unknown };

function storedEntity<T extends TenantEntity>(row: EntityRow, tenantId: string): T {
  if (row.tenant_id !== tenantId || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) throw new Error('Invalid stored entity');
  const data = row.data as Readonly<Record<string, unknown>>;
  if (data.id !== row.entity_id || data.tenantId !== tenantId) throw new Error('Invalid stored entity identity');
  return data as T;
}

function ensureTenant(context: AccessContext, tenantId: string): void {
  if (context.tenantId !== tenantId) throw new Error('Cross-tenant access denied');
}

export class RuntimeIds implements ApplicationRuntime, AccessGrantRuntime {
  now(): string { return new Date().toISOString(); }
  nextId(scope: ApplicationIdScope | 'access-grant'): string { return `${scope}-${crypto.randomUUID()}`; }
  nextEntityId(scope: 'emergency-contact'): string { return `${scope}-${crypto.randomUUID()}`; }
}

abstract class PendingEntityUnitOfWork {
  protected readonly tenantId: string;
  #pending?: PendingEntityChange;
  constructor(tenantId: string) { this.tenantId = tenantId; }
  protected stage(change: PendingEntityChange): void {
    if (this.#pending) throw new Error('Only one entity mutation is allowed per request');
    this.#pending = change;
  }
  async flush(database: SupabaseRestDatabase): Promise<void> {
    const pending = this.#pending;
    if (!pending) return;
    if (pending.kind === 'upsert') {
      await database.applyEntityChange({
        p_tenant_id: this.tenantId,
        p_entity_type: pending.entityType,
        p_entity_id: pending.entityId,
        p_data: pending.data,
        p_expected_version: pending.expectedVersion,
        p_audit: pending.auditEvent,
        p_event: pending.domainEvent,
      });
    } else {
      await database.deleteEntityChange({
        p_tenant_id: this.tenantId,
        p_entity_type: pending.entityType,
        p_entity_id: pending.entityId,
        p_expected_version: pending.expectedVersion,
        p_audit: pending.auditEvent,
        p_event: pending.domainEvent,
      });
    }
    this.#pending = undefined;
  }
}

export class PeopleSnapshotUnitOfWork extends PendingEntityUnitOfWork implements PeopleUnitOfWork {
  readonly #rows = new Map<string, { person: CongregationPerson; version: number }>();
  constructor(tenantId: string, rows: readonly EntityRow[]) {
    super(tenantId);
    for (const row of rows) this.#rows.set(row.entity_id, { person: storedEntity<CongregationPerson>(row, tenantId), version: row.version });
  }
  list(context: AccessContext): readonly CongregationPerson[] { ensureTenant(context, this.tenantId); return Object.freeze([...this.#rows.values()].map(row => row.person)); }
  findById(context: AccessContext, personId: string): CongregationPerson | undefined { ensureTenant(context, this.tenantId); return this.#rows.get(personId)?.person; }
  commitCreate(context: AccessContext, change: PersonChange): CongregationPerson {
    ensureTenant(context, this.tenantId);
    if (this.#rows.has(change.person.id)) throw new Error('Person already exists');
    this.stage({ kind: 'upsert', entityType: 'person', entityId: change.person.id, data: change.person, expectedVersion: null, auditEvent: change.auditEvent, domainEvent: change.domainEvent });
    this.#rows.set(change.person.id, { person: change.person, version: 1 });
    return change.person;
  }
  commitUpdate(context: AccessContext, change: PersonChange): CongregationPerson {
    ensureTenant(context, this.tenantId);
    const existing = this.#rows.get(change.person.id); if (!existing) throw new Error('Person not found');
    this.stage({ kind: 'upsert', entityType: 'person', entityId: change.person.id, data: change.person, expectedVersion: existing.version, auditEvent: change.auditEvent, domainEvent: change.domainEvent });
    this.#rows.set(change.person.id, { person: change.person, version: existing.version + 1 });
    return change.person;
  }
}

export class OrganizationSnapshotUnitOfWork extends PendingEntityUnitOfWork implements HouseholdUnitOfWork, ServiceGroupUnitOfWork, ResponsibilityUnitOfWork {
  readonly #households = new Map<string, { value: Household; version: number }>();
  readonly #groups = new Map<string, { value: ServiceGroup; version: number }>();
  readonly #responsibilities = new Map<string, { value: ResponsibilityAssignment; version: number }>();
  constructor(tenantId: string, households: readonly EntityRow[], groups: readonly EntityRow[], responsibilities: readonly EntityRow[]) {
    super(tenantId);
    households.forEach(row => this.#households.set(row.entity_id, { value: storedEntity<Household>(row, tenantId), version: row.version }));
    groups.forEach(row => this.#groups.set(row.entity_id, { value: storedEntity<ServiceGroup>(row, tenantId), version: row.version }));
    responsibilities.forEach(row => this.#responsibilities.set(row.entity_id, { value: storedEntity<ResponsibilityAssignment>(row, tenantId), version: row.version }));
  }
  listHouseholds(context: AccessContext): readonly Household[] { ensureTenant(context, this.tenantId); return Object.freeze([...this.#households.values()].map(row => row.value)); }
  findHouseholdById(context: AccessContext, id: string): Household | undefined { ensureTenant(context, this.tenantId); return this.#households.get(id)?.value; }
  commitHouseholdCreate(context: AccessContext, change: HouseholdChange): Household { ensureTenant(context, this.tenantId); if(this.#households.has(change.household.id)) throw new Error('Household already exists'); this.stage({kind:'upsert',entityType:'household',entityId:change.household.id,data:change.household,expectedVersion:null,auditEvent:change.auditEvent,domainEvent:change.domainEvent}); this.#households.set(change.household.id,{value:change.household,version:1}); return change.household; }
  commitHouseholdUpdate(context: AccessContext, change: HouseholdChange): Household { ensureTenant(context,this.tenantId); const row=this.#households.get(change.household.id); if(!row) throw new Error('Household not found'); this.stage({kind:'upsert',entityType:'household',entityId:change.household.id,data:change.household,expectedVersion:row.version,auditEvent:change.auditEvent,domainEvent:change.domainEvent}); this.#households.set(change.household.id,{value:change.household,version:row.version+1}); return change.household; }
  commitHouseholdDelete(context: AccessContext,id:string,change:OrganizationDeletionChange):boolean { ensureTenant(context,this.tenantId); const row=this.#households.get(id); if(!row) return false; this.stage({kind:'delete',entityType:'household',entityId:id,expectedVersion:row.version,auditEvent:change.auditEvent,domainEvent:change.domainEvent}); this.#households.delete(id); return true; }
  listServiceGroups(context: AccessContext): readonly ServiceGroup[] { ensureTenant(context,this.tenantId); return Object.freeze([...this.#groups.values()].map(row=>row.value)); }
  findServiceGroupById(context: AccessContext,id:string):ServiceGroup|undefined { ensureTenant(context,this.tenantId); return this.#groups.get(id)?.value; }
  commitServiceGroupCreate(context:AccessContext,change:ServiceGroupChange):ServiceGroup { ensureTenant(context,this.tenantId); if(this.#groups.has(change.serviceGroup.id)) throw new Error('Service group already exists'); this.stage({kind:'upsert',entityType:'service-group',entityId:change.serviceGroup.id,data:change.serviceGroup,expectedVersion:null,auditEvent:change.auditEvent,domainEvent:change.domainEvent}); this.#groups.set(change.serviceGroup.id,{value:change.serviceGroup,version:1}); return change.serviceGroup; }
  commitServiceGroupUpdate(context:AccessContext,change:ServiceGroupChange):ServiceGroup { ensureTenant(context,this.tenantId); const row=this.#groups.get(change.serviceGroup.id); if(!row) throw new Error('Service group not found'); this.stage({kind:'upsert',entityType:'service-group',entityId:change.serviceGroup.id,data:change.serviceGroup,expectedVersion:row.version,auditEvent:change.auditEvent,domainEvent:change.domainEvent}); this.#groups.set(change.serviceGroup.id,{value:change.serviceGroup,version:row.version+1}); return change.serviceGroup; }
  commitServiceGroupDelete(context:AccessContext,id:string,change:OrganizationDeletionChange):boolean { ensureTenant(context,this.tenantId); const row=this.#groups.get(id); if(!row) return false; this.stage({kind:'delete',entityType:'service-group',entityId:id,expectedVersion:row.version,auditEvent:change.auditEvent,domainEvent:change.domainEvent}); this.#groups.delete(id); return true; }
  listResponsibilities(context:AccessContext):readonly ResponsibilityAssignment[] { ensureTenant(context,this.tenantId); return Object.freeze([...this.#responsibilities.values()].map(row=>row.value)); }
  findResponsibilityById(context:AccessContext,id:string):ResponsibilityAssignment|undefined { ensureTenant(context,this.tenantId); return this.#responsibilities.get(id)?.value; }
  commitResponsibilityCreate(context:AccessContext,change:ResponsibilityChange):ResponsibilityAssignment { ensureTenant(context,this.tenantId); if(this.#responsibilities.has(change.responsibility.id)) throw new Error('Responsibility already exists'); this.stage({kind:'upsert',entityType:'responsibility',entityId:change.responsibility.id,data:change.responsibility,expectedVersion:null,auditEvent:change.auditEvent,domainEvent:change.domainEvent}); this.#responsibilities.set(change.responsibility.id,{value:change.responsibility,version:1}); return change.responsibility; }
  commitResponsibilityUpdate(context:AccessContext,change:ResponsibilityChange):ResponsibilityAssignment { ensureTenant(context,this.tenantId); const row=this.#responsibilities.get(change.responsibility.id); if(!row) throw new Error('Responsibility not found'); this.stage({kind:'upsert',entityType:'responsibility',entityId:change.responsibility.id,data:change.responsibility,expectedVersion:row.version,auditEvent:change.auditEvent,domainEvent:change.domainEvent}); this.#responsibilities.set(change.responsibility.id,{value:change.responsibility,version:row.version+1}); return change.responsibility; }
}

export class AccessGrantSnapshotUnitOfWork implements AccessGrantUnitOfWork {
  readonly #tenantId: string;
  readonly #grants = new Map<string, Readonly<AccessGrant>>();
  #pending?: PendingGrantChange;
  constructor(tenantId: string, rows: readonly AccessGrantRow[]) {
    this.#tenantId=tenantId;
    for(const row of rows){ if(row.tenant_id!==tenantId) throw new Error('Cross-tenant stored grant'); this.#grants.set(row.id,{id:row.id,tenantId:row.tenant_id,subjectId:row.subject_id,capability:row.capability as AccessGrant['capability'],grantedBy:row.granted_by,grantedAt:row.granted_at,...(row.revoked_at?{revokedAt:row.revoked_at}:{})}); }
  }
  listBySubject(context:AccessContext,subjectId:string):readonly Readonly<AccessGrant>[] { ensureTenant(context,this.#tenantId); return Object.freeze([...this.#grants.values()].filter(grant=>grant.subjectId===subjectId)); }
  findById(context:AccessContext,grantId:string):Readonly<AccessGrant>|undefined { ensureTenant(context,this.#tenantId); return this.#grants.get(grantId); }
  commitCreate(context:AccessContext,change:AccessGrantChange):Readonly<AccessGrant>{ ensureTenant(context,this.#tenantId); if(this.#pending) throw new Error('Only one grant mutation is allowed per request'); this.#pending={grant:change.grant,auditEvent:change.auditEvent,domainEvent:change.domainEvent}; this.#grants.set(change.grant.id,change.grant); return change.grant; }
  commitUpdate(context:AccessContext,change:AccessGrantChange):Readonly<AccessGrant>{ ensureTenant(context,this.#tenantId); if(this.#pending) throw new Error('Only one grant mutation is allowed per request'); this.#pending={grant:change.grant,auditEvent:change.auditEvent,domainEvent:change.domainEvent}; this.#grants.set(change.grant.id,change.grant); return change.grant; }
  async flush(database:SupabaseRestDatabase):Promise<void>{ const p=this.#pending;if(!p)return;await database.createGrantChange({p_tenant_id:this.#tenantId,p_grant:p.grant,p_audit:p.auditEvent,p_event:p.domainEvent});this.#pending=undefined; }
}
