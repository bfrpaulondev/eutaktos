import { isCapability, type Capability } from './access-control';
import type { PersonId, TenantId } from './people';

export type AccessGrantId = string;

export interface AccessGrant {
  id: AccessGrantId;
  tenantId: TenantId;
  subjectId: PersonId;
  capability: Capability;
  grantedBy: PersonId;
  grantedAt: string;
  revokedAt?: string;
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.length > 200) throw new Error(`${field} is too long`);
  return normalized;
}

function instant(value: string, field: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${field} must be a valid ISO date`);
  return value;
}

export function createAccessGrant(input: AccessGrant): Readonly<AccessGrant> {
  const id = required(input.id, 'accessGrantId');
  const tenantId = required(input.tenantId, 'tenantId');
  const subjectId = required(input.subjectId, 'subjectId');
  const grantedBy = required(input.grantedBy, 'grantedBy');
  if (!isCapability(input.capability)) throw new Error('Unsupported capability');
  const grantedAt = instant(input.grantedAt, 'grantedAt');
  const revokedAt = input.revokedAt === undefined ? undefined : instant(input.revokedAt, 'revokedAt');
  if (revokedAt !== undefined && Date.parse(revokedAt) < Date.parse(grantedAt)) {
    throw new Error('revokedAt cannot be earlier than grantedAt');
  }
  return Object.freeze({
    id,
    tenantId,
    subjectId,
    capability: input.capability,
    grantedBy,
    grantedAt,
    ...(revokedAt !== undefined ? { revokedAt } : {}),
  });
}

export function revokeAccessGrant(grant: AccessGrant, revokedAt: string): Readonly<AccessGrant> {
  if (grant.revokedAt) return createAccessGrant(grant);
  return createAccessGrant({ ...grant, revokedAt });
}

export function isActiveAccessGrant(grant: AccessGrant): boolean {
  return grant.revokedAt === undefined;
}
