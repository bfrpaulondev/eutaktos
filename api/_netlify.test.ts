import { describe, expect, it } from 'vitest';
import { handleNetlifyApiEvent, matchNetlifyApiRoute, normalizeNetlifyApiPath } from './_netlify';

describe('Netlify API adapter', () => {
  it('normalizes both public and rewritten Netlify paths', () => {
    expect(normalizeNetlifyApiPath({ path: '/api/people' })).toBe('/people');
    expect(normalizeNetlifyApiPath({ path: '/.netlify/functions/api/people/person-1' })).toBe('/people/person-1');
    expect(normalizeNetlifyApiPath({ rawUrl: 'https://eutakes.netlify.app/api/health?x=1' })).toBe('/health');
    expect(normalizeNetlifyApiPath({ path: '/.netlify/functions/api/midweek/meetings/m-1/publish' })).toBe('/midweek/meetings/m-1/publish');
  });

  it('matches dynamic identifiers from the path', () => {
    expect(matchNetlifyApiRoute('/people/person-1')).toEqual({ key: 'person', params: { personId: 'person-1' } });
    expect(matchNetlifyApiRoute('/responsibilities/res-1/end')).toEqual({ key: 'end-responsibility', params: { responsibilityId: 'res-1' } });
    expect(matchNetlifyApiRoute('/access/subjects/actor-1/grants')).toEqual({ key: 'subject-grants', params: { subjectId: 'actor-1' } });
    expect(matchNetlifyApiRoute('/people/%2Fetc')).toBeUndefined();
  });

  it('routes the real midweek overview and mutation paths through the central Netlify function', () => {
    expect(matchNetlifyApiRoute('/midweek')).toEqual({ key: 'midweek', params: {} });
    expect(matchNetlifyApiRoute('/midweek/meetings/m-1/publish')).toEqual({ key: 'midweek-route', params: { route: 'meetings/m-1/publish' } });
    expect(matchNetlifyApiRoute('/midweek/student-assignments/a-1/replace')).toEqual({ key: 'midweek-route', params: { route: 'student-assignments/a-1/replace' } });
    expect(matchNetlifyApiRoute('/midweek/meetings/%2Fetc/publish')).toBeUndefined();
  });

  it('executes the real health handler through the adapter', async () => {
    const result = await handleNetlifyApiEvent({ httpMethod: 'GET', path: '/api/health', headers: {} });
    expect(result.statusCode).toBe(200);
    expect(result.headers['Cache-Control']).toBe('no-store');
    expect(JSON.parse(result.body)).toEqual({ status: 'ok', service: 'eutaktos-api' });
  });

  it('returns safe errors for unknown routes and malformed JSON', async () => {
    const missing = await handleNetlifyApiEvent({ httpMethod: 'GET', path: '/api/not-a-route', headers: {} });
    expect(missing.statusCode).toBe(404);
    expect(JSON.parse(missing.body)).toEqual({ error: 'Not found' });

    const malformed = await handleNetlifyApiEvent({
      httpMethod: 'POST',
      path: '/api/people',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect(malformed.statusCode).toBe(400);
    expect(JSON.parse(malformed.body)).toEqual({ error: 'Invalid JSON body' });
  });
});
