import type { PersonId, TenantId } from './people';

export const CAPABILITIES = Object.freeze([
  'people.read',
  'people.write',
  'eligibility.read',
  'eligibility.write',
  'availability.read',
  'availability.write',
  'emergency-contacts.read',
  'emergency-contacts.write',
  'responsibilities.read',
  'responsibilities.write',
  'delegations.read',
  'delegations.write',
  'schedule.read',
  'schedule.write',
  'reports.read',
  'reports.write',
  'review.read',
  'review.write',
  'audit.read',
  'access.manage',
  'tenant.manage',
] as const);

export type Capability = (typeof CAPABILITIES)[number];

export interface AccessContext {
  tenantId: TenantId;
  actorId: PersonId;
  capabilities: readonly Capability[];
}

export interface TenantScopedResource {
  tenantId: TenantId;
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

export function isCapability(value: unknown): value is Capability {
  return typeof value === 'string' && (CAPABILITIES as readonly string[]).includes(value);
}

export function createAccessContext(input: AccessContext): Readonly<AccessContext> {
  required(input.tenantId, 'tenantId');
  required(input.actorId, 'actorId');

  const capabilities = [...new Set(input.capabilities)].sort();
  return Object.freeze({ ...input, capabilities: Object.freeze(capabilities) });
}

export function hasCapability(context: AccessContext, capability: Capability): boolean {
  return context.capabilities.includes(capability);
}

export function assertCapability(context: AccessContext, capability: Capability): void {
  if (!hasCapability(context, capability)) {
    throw new Error(`Access denied: missing capability ${capability}`);
  }
}

export function assertResourceTenant(context: AccessContext, resource: TenantScopedResource): void {
  if (resource.tenantId !== context.tenantId) {
    throw new Error('Cross-tenant access denied');
  }
}

export function authorizeResource(
  context: AccessContext,
  resource: TenantScopedResource,
  capability: Capability,
): void {
  assertResourceTenant(context, resource);
  assertCapability(context, capability);
}

export function canAccessResource(
  context: AccessContext,
  resource: TenantScopedResource,
  capability: Capability,
): boolean {
  return resource.tenantId === context.tenantId && hasCapability(context, capability);
}

/**
 * Highly sensitive capabilities are deliberately separate from general tenant
 * administration. A congregation administrator must not gain Review Center,
 * eligibility, delegation, access-management or emergency-contact access merely
 * by holding `tenant.manage`.
 */
export const SENSITIVE_CAPABILITIES: readonly Capability[] = Object.freeze([
  'eligibility.write',
  'emergency-contacts.read',
  'emergency-contacts.write',
  'delegations.read',
  'delegations.write',
  'review.read',
  'review.write',
  'audit.read',
  'access.manage',
]);
