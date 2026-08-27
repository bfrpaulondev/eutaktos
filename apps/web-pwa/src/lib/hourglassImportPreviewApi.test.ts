import { describe, expect, it, vi } from 'vitest';
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
    const fetcher = vi.fn(async () => new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const api = createHourglassImportPreviewApi(fetcher as typeof fetch);
    await api.preview({ publishers: [] });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/import/hourglass/preview');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ source: 'json', payload: { publishers: [] } });
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
