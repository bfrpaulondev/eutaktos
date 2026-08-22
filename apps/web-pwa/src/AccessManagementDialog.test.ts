import { describe, expect, it } from 'vitest';
import { ACCESS_CAPABILITIES } from './lib/accessGrantApi';
import { canConfirmAccessGrant, capabilityGroup, isSensitiveCapability } from './AccessManagementDialog';

describe('AccessManagementDialog capability presentation', () => {
  it('places every canonical capability into one UI group without changing its ID', () => {
    const grouped = ACCESS_CAPABILITIES.map(capability => capabilityGroup(capability));
    expect(grouped).not.toContain(undefined);
    expect(capabilityGroup('people.read')).toBe('people');
    expect(capabilityGroup('availability.write')).toBe('availability');
    expect(capabilityGroup('schedule.read')).toBe('operations');
    expect(capabilityGroup('audit.read')).toBe('review');
    expect(capabilityGroup('tenant.manage')).toBe('administration');
  });

  it('marks sensitive capabilities for confirmation without granting them automatically', () => {
    expect(isSensitiveCapability('access.manage')).toBe(true);
    expect(isSensitiveCapability('tenant.manage')).toBe(true);
    expect(isSensitiveCapability('people.read')).toBe(false);
  });

  it('requires a confirmed grant list before allowing a new explicit grant', () => {
    const active = new Set(['people.read'] as const);
    expect(canConfirmAccessGrant('person-1', 'people.write', false, active, false)).toBe(false);
    expect(canConfirmAccessGrant('person-1', 'people.read', true, active, false)).toBe(false);
    expect(canConfirmAccessGrant('person-1', 'people.write', true, active, true)).toBe(false);
    expect(canConfirmAccessGrant('person-1', 'people.write', true, active, false)).toBe(true);
  });
});
