import type { AccessContext, Capability, TenantScopedResource } from './access-control';
import { assertCapability, assertResourceTenant } from './access-control';

export interface IdentifiedTenantResource extends TenantScopedResource {
  id: string;
}

export interface TenantRepository<T extends IdentifiedTenantResource> {
  list(context: AccessContext): readonly T[];
  findById(context: AccessContext, id: string): T | undefined;
  insert(context: AccessContext, resource: T): T;
  replace(context: AccessContext, resource: T): T;
  save(context: AccessContext, resource: T): T;
  delete(context: AccessContext, id: string): boolean;
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function storageKey(tenantId: string, id: string): string {
  return `${required(tenantId, 'tenantId')}\u0000${required(id, 'resourceId')}`;
}

/**
 * A deterministic in-memory adapter used by tests and early application wiring.
 * The authorization checks live at the repository boundary so callers cannot
 * accidentally bypass tenant isolation by filtering only in the UI/service layer.
 * Production persistence adapters must preserve the same contract and enforce
 * tenant predicates in their database queries.
 */
export class InMemoryTenantRepository<T extends IdentifiedTenantResource>
  implements TenantRepository<T>
{
  readonly #readCapability: Capability;
  readonly #writeCapability: Capability;
  readonly #records = new Map<string, T>();

  constructor(readCapability: Capability, writeCapability: Capability, seed: readonly T[] = []) {
    this.#readCapability = readCapability;
    this.#writeCapability = writeCapability;

    for (const resource of seed) {
      const key = storageKey(resource.tenantId, resource.id);
      if (this.#records.has(key)) throw new Error('Duplicate tenant resource id');
      this.#records.set(key, resource);
    }
  }

  list(context: AccessContext): readonly T[] {
    assertCapability(context, this.#readCapability);
    return [...this.#records.values()].filter(resource => resource.tenantId === context.tenantId);
  }

  findById(context: AccessContext, id: string): T | undefined {
    assertCapability(context, this.#readCapability);
    return this.#records.get(storageKey(context.tenantId, id));
  }

  insert(context: AccessContext, resource: T): T {
    assertCapability(context, this.#writeCapability);
    assertResourceTenant(context, resource);
    const key = storageKey(context.tenantId, resource.id);
    if (this.#records.has(key)) throw new Error('Tenant resource already exists');
    this.#records.set(key, resource);
    return resource;
  }

  replace(context: AccessContext, resource: T): T {
    assertCapability(context, this.#writeCapability);
    assertResourceTenant(context, resource);
    const key = storageKey(context.tenantId, resource.id);
    if (!this.#records.has(key)) throw new Error('Tenant resource does not exist');
    this.#records.set(key, resource);
    return resource;
  }

  save(context: AccessContext, resource: T): T {
    assertCapability(context, this.#writeCapability);
    assertResourceTenant(context, resource);
    this.#records.set(storageKey(context.tenantId, resource.id), resource);
    return resource;
  }

  delete(context: AccessContext, id: string): boolean {
    assertCapability(context, this.#writeCapability);
    return this.#records.delete(storageKey(context.tenantId, id));
  }
}
