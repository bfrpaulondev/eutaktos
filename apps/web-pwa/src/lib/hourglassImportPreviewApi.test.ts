import { describe, expect, it } from 'vitest';
import { createHourglassImportPreviewApi, HourglassPreviewApiError, parseHourglassPreviewResponse } from './hourglassImportPreviewApi';

const response = {
  matchingPolicy: 'tenant-scoped-external-id-only',
  counts: { create: 1, unchanged: 0, conflict: 0 },
  report: {
    format: 'hourglass-json-export-v1', publisherCount: 1, groupCount: 0, explicitPrivilegeCount: 0,
    unknownTopLevelSections: [], unknownPublisherFields: [], unknownGroupFields: [], recognizedSections: ['publishers', 'fsGroups', 'privileges'],
  },
  persons: [{ displayName: 'Ana Exemplo', action: 'create', linked: false, reasonCodes: [], explicitAssignmentTypeIds: [] }],
};

describe('Hourglass import preview API', () => {
  it('posts only the explicit JSON preview contract to the same-origin endpoint', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ input, init });
      return new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const api = createHourglassImportPreviewApi(fetcher);
    await api.preview({ publishers: [] });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe('/api/import/hourglass/preview');
    expect(calls[0]?.init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ source: 'json', payload: { publishers: [] } });
  });

  it('keeps 401/403 distinguishable for the UI', async () => {
    for (const status of [401, 403]) {
      const api = createHourglassImportPreviewApi((async () => new Response('{}', { status })) as typeof fetch);
      await expect(api.preview({})).rejects.toMatchObject({ name: 'HourglassPreviewApiError', status });
    }
    expect(new HourglassPreviewApiError(403).message).toContain('(403)');
  });

  it('rejects malformed counts, actions and reason codes instead of repairing server evidence', () => {
    expect(() => parseHourglassPreviewResponse({ ...response, counts: { create: 2, unchanged: 0, conflict: 0 } })).toThrow();
    expect(() => parseHourglassPreviewResponse({ ...response, persons: [{ ...response.persons[0], action: 'merge' }] })).toThrow();
    expect(() => parseHourglassPreviewResponse({ ...response, persons: [{ ...response.persons[0], reasonCodes: ['NAME_MATCH'] }] })).toThrow();
  });
});
