import { describe, expect, it } from 'vitest';
import { parseHourglassExecuteRequest, parseHourglassPrepareRequest, parseHourglassRollbackRequest } from './_request';

const payload = { publishers: [{ id: 1, firstname: 'Ana', lastname: 'Silva' }], fsGroups: [], privileges: {} };
const executionId = `hourglass-execution-${'a'.repeat(32)}`;
const confirmationDigest = 'c'.repeat(64);

describe('PX9.9 Hourglass execution request parsing', () => {
  it('accepts only the proven JSON source plus opaque retry/execution identities and prepared confirmation digest', () => {
    expect(parseHourglassPrepareRequest({ query: {}, body: { source: 'json', payload, mutationId: 'mutation-12345678' } }).mutationId).toBe('mutation-12345678');
    expect(parseHourglassExecuteRequest({ query: {}, body: { source: 'json', payload, executionId, confirmationDigest } })).toMatchObject({ executionId, confirmationDigest });
    expect(parseHourglassRollbackRequest({ query: {}, body: { migrationId: `hourglass-migration-${'b'.repeat(32)}` } })).toBe(`hourglass-migration-${'b'.repeat(32)}`);
  });

  it('rejects authority smuggling and unknown fields', () => {
    expect(() => parseHourglassPrepareRequest({ query: {}, body: { source: 'json', payload, mutationId: 'mutation-12345678', tenantId: 'other' } })).toThrow('Unknown request field');
    expect(() => parseHourglassExecuteRequest({ query: {}, body: { source: 'json', payload, executionId, confirmationDigest, actorId: 'other' } })).toThrow('Unknown request field');
    expect(() => parseHourglassRollbackRequest({ query: { tenantId: 'other' }, body: { migrationId: `hourglass-migration-${'b'.repeat(32)}` } })).toThrow('does not accept query fields');
  });

  it('rejects unproven sources, malformed ids and missing confirmation proof', () => {
    expect(() => parseHourglassPrepareRequest({ query: {}, body: { source: 'contacts-csv', payload, mutationId: 'mutation-12345678' } })).toThrow('Only the proven Hourglass JSON source');
    expect(() => parseHourglassExecuteRequest({ query: {}, body: { source: 'json', payload, executionId: '../migration', confirmationDigest } })).toThrow('executionId is invalid');
    expect(() => parseHourglassExecuteRequest({ query: {}, body: { source: 'json', payload, executionId } })).toThrow('confirmationDigest must be a string');
  });
});
