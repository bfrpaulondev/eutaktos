import { describe, expect, it, vi } from 'vitest';
import {
  createHourglassImportExecutionApi,
  parseHourglassExecutionResultResponse,
  parseHourglassPreparedExecutionResponse,
  parseHourglassRollbackResultResponse,
} from './hourglassImportExecutionApi';

const preview = {
  matchingPolicy: 'tenant-scoped-external-id-only',
  counts: { create: 1, unchanged: 0, conflict: 0 },
  report: {
    format: 'hourglass-json-export-v1',
    publisherCount: 1,
    groupCount: 0,
    explicitPrivilegeCount: 0,
    unknownTopLevelSections: [],
    unknownPublisherFields: [],
    unknownGroupFields: [],
    recognizedSections: ['publishers'],
  },
  persons: [{ displayName: 'Ana Silva', action: 'create', linked: false, reasonCodes: [], explicitAssignmentTypeIds: [] }],
} as const;

const prepared = {
  contractVersion: 'hourglass-execution-prepare-v1',
  executionId: `hourglass-execution-${'a'.repeat(32)}`,
  expiresAt: '2026-08-27T12:30:00.000Z',
  confirmationDigest: 'b'.repeat(64),
  counts: { create: 1, unchanged: 0, conflict: 0 },
  canExecute: true,
  preview,
} as const;

const migrationId = `hourglass-migration-${'c'.repeat(32)}`;

describe('Hourglass execution API client', () => {
  it('parses only the reviewed prepare contract and rejects inconsistent execution authority', () => {
    expect(parseHourglassPreparedExecutionResponse(prepared)).toMatchObject({ executionId: prepared.executionId, confirmationDigest: prepared.confirmationDigest, canExecute: true });
    expect(() => parseHourglassPreparedExecutionResponse({ ...prepared, canExecute: false })).toThrow('Invalid Hourglass execution response');
    expect(() => parseHourglassPreparedExecutionResponse({ ...prepared, confirmationDigest: 'not-a-digest' })).toThrow('Invalid Hourglass execution response');
  });

  it('parses applied and already-applied execution results', () => {
    expect(parseHourglassExecutionResultResponse({ contractVersion: 'hourglass-execution-result-v1', outcome: 'applied', migrationId, createdCount: 1, unchangedCount: 0 })).toEqual({ outcome: 'applied', migrationId, createdCount: 1, unchangedCount: 0 });
    expect(parseHourglassExecutionResultResponse({ contractVersion: 'hourglass-execution-result-v1', outcome: 'already-applied', createdCount: 1, unchangedCount: 0 }).outcome).toBe('already-applied');
  });

  it('parses only the reviewed rollback result contract', () => {
    expect(parseHourglassRollbackResultResponse({ contractVersion: 'hourglass-rollback-result-v1', outcome: 'rolled-back', migrationId, removedCount: 1 })).toEqual({ outcome: 'rolled-back', migrationId, removedCount: 1 });
    expect(() => parseHourglassRollbackResultResponse({ contractVersion: 'hourglass-rollback-result-v1', outcome: 'rolled-back', migrationId: 'bad', removedCount: 1 })).toThrow('Invalid Hourglass execution response');
  });

  it('posts only reviewed fields with same-origin credentials for prepare execute and rollback', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(prepared), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ contractVersion: 'hourglass-execution-result-v1', outcome: 'applied', migrationId, createdCount: 1, unchangedCount: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ contractVersion: 'hourglass-rollback-result-v1', outcome: 'rolled-back', migrationId, removedCount: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const api = createHourglassImportExecutionApi(fetcher);
    const payload = { publishers: [{ id: 1, firstname: 'Ana', lastname: 'Silva' }] };
    const confirmation = await api.prepare(payload, 'mutation-12345678');
    const result = await api.execute(payload, confirmation.executionId, confirmation.confirmationDigest);
    await api.rollback(result.migrationId!);

    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/import/hourglass/prepare', expect.objectContaining({ method: 'POST', credentials: 'same-origin', body: JSON.stringify({ source: 'json', payload, mutationId: 'mutation-12345678' }) }));
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/import/hourglass/execute', expect.objectContaining({ method: 'POST', credentials: 'same-origin', body: JSON.stringify({ source: 'json', payload, executionId: confirmation.executionId, confirmationDigest: confirmation.confirmationDigest }) }));
    expect(fetcher).toHaveBeenNthCalledWith(3, '/api/import/hourglass/rollback', expect.objectContaining({ method: 'POST', credentials: 'same-origin', body: JSON.stringify({ migrationId }) }));
  });

  it('preserves HTTP authorization failures as explicit status errors', async () => {
    const api = createHourglassImportExecutionApi(vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })));
    await expect(api.prepare({}, 'mutation-12345678')).rejects.toMatchObject({ name: 'HourglassExecutionApiError', status: 403 });
  });
});
