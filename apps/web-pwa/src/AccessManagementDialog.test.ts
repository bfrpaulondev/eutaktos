import { describe, expect, it } from 'vitest';
import { ACCESS_CAPABILITIES } from './lib/accessGrantApi';
import { capabilityGroup, isSensitiveCapability } from './AccessManagementDialog';

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
});
