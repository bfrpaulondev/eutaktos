import { describe, expect, it } from 'vitest';
import type { CongregationPerson } from '@eutaktos/domain';
import {
  createPeopleTransferSecret,
  hashPeopleTransferCode,
  parseSendPeopleTransferBody,
  parseTransferCodeBody,
  transferPayloadFromPeople,
  transferStatus,
} from './transfer-contract';

const person: CongregationPerson = Object.freeze({
  id: 'person-1',
  tenantId: 'tenant-a',
  displayName: 'Ana Example',
  preferredLocale: 'pt-PT',
  active: true,
  externalIds: ['hourglass:secret-source-id'],
  labels: ['local-label'],
  availability: Object.freeze([{ id: 'away-1', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-09-02T00:00:00.000Z' }]),
  eligibility: Object.freeze([{ assignmentTypeId: 'reading', enabled: true, decidedBy: 'elder-secret', decidedAt: '2026-01-01T00:00:00.000Z' }]),
  ordinaryContact: Object.freeze({ phone: '+351 210000000', email: 'ana@example.org', address: 'Rua 1' }),
  emergencyContacts: Object.freeze([{ id: 'emergency-1', name: 'Private emergency', phone: '+351 999999999' }]),
});

describe('PX9 People transfer contract', () => {
  it('accepts only a bounded unique person selection', () => {
    expect(parseSendPeopleTransferBody({ personIds: ['p1', 'p2'] })).toEqual(['p1', 'p2']);
    expect(() => parseSendPeopleTransferBody({ personIds: [] })).toThrow('must not be empty');
    expect(() => parseSendPeopleTransferBody({ personIds: ['p1', 'p1'] })).toThrow('duplicates');
    expect(() => parseSendPeopleTransferBody({ personIds: ['p1'], tenantId: 'forged' })).toThrow('Unknown request field');
  });

  it('projects only cross-congregation identity and ordinary Contact facts', () => {
    const payload = transferPayloadFromPeople([person]);
    expect(payload).toEqual([{ displayName: 'Ana Example', preferredLocale: 'pt-PT', ordinaryContact: { phone: '+351 210000000', email: 'ana@example.org', address: 'Rua 1' } }]);
    const json = JSON.stringify(payload);
    for (const forbidden of ['tenant-a', 'person-1', 'elder-secret', 'hourglass:secret-source-id', 'local-label', 'Private emergency', '999999999', 'away-1', 'eligibility']) expect(json).not.toContain(forbidden);
  });

  it('generates a 256-bit opaque code and hashes the decoded secret consistently', async () => {
    const secret = createPeopleTransferSecret();
    expect(secret.code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const hash = await secret.tokenHash;
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashPeopleTransferCode(secret.code)).toBe(hash);
    expect(parseTransferCodeBody({ code: secret.code })).toBe(secret.code);
    expect(() => parseTransferCodeBody({ code: secret.code, tenantId: 'forged' })).toThrow('Unknown request field');
  });

  it('derives outbound status without trusting the browser', () => {
    expect(transferStatus({ expiresAt: '2030-01-02T00:00:00.000Z' }, Date.parse('2030-01-01T00:00:00.000Z'))).toBe('pending');
    expect(transferStatus({ expiresAt: '2030-01-01T00:00:00.000Z' }, Date.parse('2030-01-01T00:00:00.000Z'))).toBe('expired');
    expect(transferStatus({ expiresAt: '2030-01-02T00:00:00.000Z', claimedAt: '2030-01-01T00:00:00.000Z' })).toBe('claimed');
    expect(transferStatus({ expiresAt: '2030-01-02T00:00:00.000Z', cancelledAt: '2030-01-01T00:00:00.000Z' })).toBe('cancelled');
  });
});