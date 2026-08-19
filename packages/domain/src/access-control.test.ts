import { describe, expect, it } from 'vitest';
import {
  SENSITIVE_CAPABILITIES,
  assertCapability,
  authorizeResource,
  canAccessResource,
  createAccessContext,
} from './access-control';

describe('access control', () => {
  const context = createAccessContext({
    tenantId: 'tenant-a',
    actorId: 'person-admin',
    capabilities: ['people.read', 'people.write', 'tenant.manage', 'people.read'],
  });

  it('deduplicates capabilities and preserves tenant identity', () => {
    expect(context.capabilities).toEqual(['people.read', 'people.write', 'tenant.manage']);
    expect(context.tenantId).toBe('tenant-a');
  });

  it('allows a capability only inside the same tenant', () => {
    expect(canAccessResource(context, { tenantId: 'tenant-a' }, 'people.read')).toBe(true);
    expect(canAccessResource(context, { tenantId: 'tenant-b' }, 'people.read')).toBe(false);
  });

  it('denies cross-tenant access before capability evaluation', () => {
    expect(() => authorizeResource(context, { tenantId: 'tenant-b' }, 'people.read')).toThrow('Cross-tenant access denied');
  });

  it('denies missing capabilities', () => {
    expect(() => assertCapability(context, 'eligibility.write')).toThrow('missing capability eligibility.write');
  });

  it('does not let tenant administration imply sensitive access', () => {
    for (const capability of SENSITIVE_CAPABILITIES) {
      expect(canAccessResource(context, { tenantId: 'tenant-a' }, capability)).toBe(false);
    }
  });

  it('rejects invalid identity context', () => {
    expect(() => createAccessContext({ tenantId: ' ', actorId: 'person-a', capabilities: [] })).toThrow('tenantId is required');
    expect(() => createAccessContext({ tenantId: 'tenant-a', actorId: '', capabilities: [] })).toThrow('actorId is required');
  });
});
