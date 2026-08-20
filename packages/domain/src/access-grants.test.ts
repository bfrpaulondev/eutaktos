import { describe, expect, it } from 'vitest';
import { createAccessGrant, isActiveAccessGrant, revokeAccessGrant } from './access-grants';
import { isCapability, SENSITIVE_CAPABILITIES } from './access-control';

describe('access grants', () => {
  const grant = createAccessGrant({
    id: 'grant-1',
    tenantId: 'tenant-a',
    subjectId: 'person-a',
    capability: 'people.read',
    grantedBy: 'admin-a',
    grantedAt: '2026-08-20T10:00:00.000Z',
  });

  it('creates explicit immutable capability grants', () => {
    expect(grant).toMatchObject({ subjectId: 'person-a', capability: 'people.read' });
    expect(isActiveAccessGrant(grant)).toBe(true);
    expect(Object.isFrozen(grant)).toBe(true);
  });

  it('revokes grants idempotently without changing the original grant time', () => {
    const revoked = revokeAccessGrant(grant, '2026-08-20T11:00:00.000Z');
    expect(revoked.revokedAt).toBe('2026-08-20T11:00:00.000Z');
    expect(revoked.grantedAt).toBe(grant.grantedAt);
    expect(isActiveAccessGrant(revoked)).toBe(false);
    expect(revokeAccessGrant(revoked, '2026-08-20T12:00:00.000Z').revokedAt).toBe(revoked.revokedAt);
  });

  it('validates capability and lifecycle timestamps', () => {
    expect(() => createAccessGrant({ ...grant, capability: 'not.real' as never })).toThrow('Unsupported capability');
    expect(() => createAccessGrant({ ...grant, revokedAt: '2026-08-20T09:00:00.000Z' }))
      .toThrow('revokedAt cannot be earlier than grantedAt');
  });

  it('treats access.manage as a real sensitive capability', () => {
    expect(isCapability('access.manage')).toBe(true);
    expect(SENSITIVE_CAPABILITIES).toContain('access.manage');
    expect(SENSITIVE_CAPABILITIES).not.toContain('tenant.manage');
  });
});
