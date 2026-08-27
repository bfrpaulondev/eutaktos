import { describe, expect, it } from 'vitest';
import { handleNetlifyApiEvent, matchNetlifyApiRoute, normalizeNetlifyApiPath } from './_netlify';

describe('Netlify API adapter', () => {
  it('normalizes both public and rewritten Netlify paths', () => {
    expect(normalizeNetlifyApiPath({ path: '/api/people' })).toBe('/people');
    expect(normalizeNetlifyApiPath({ path: '/api/people/contact-list' })).toBe('/people/contact-list');
    expect(normalizeNetlifyApiPath({ path: '/api/people/recommendations' })).toBe('/people/recommendations');
    expect(normalizeNetlifyApiPath({ path: '/api/people/assistance' })).toBe('/people/assistance');
    expect(normalizeNetlifyApiPath({ path: '/api/import/hourglass/preview' })).toBe('/import/hourglass/preview');
    expect(normalizeNetlifyApiPath({ path: '/.netlify/functions/api/import/hourglass/preview' })).toBe('/import/hourglass/preview');
    expect(normalizeNetlifyApiPath({ path: '/.netlify/functions/api/people/recommendations' })).toBe('/people/recommendations');
    expect(normalizeNetlifyApiPath({ path: '/.netlify/functions/api/people/person-1' })).toBe('/people/person-1');
    expect(normalizeNetlifyApiPath({ rawUrl: 'https://example.netlify.app/api/health?x=1' })).toBe('/health');
    expect(normalizeNetlifyApiPath({ path: '/.netlify/functions/api/midweek/meetings/m-1/publish' })).toBe('/midweek/meetings/m-1/publish');
    expect(normalizeNetlifyApiPath({ path: '/api/auth/verify' })).toBe('/auth/verify');
    expect(normalizeNetlifyApiPath({ path: '/api/congregation/settings' })).toBe('/congregation/settings');
  });

  it('matches People projections, Hourglass preview and dynamic identifiers from the path', () => {
    expect(matchNetlifyApiRoute('/people/directory')).toEqual({ key: 'people-directory', params: {} });
    expect(matchNetlifyApiRoute('/people/contact-list')).toEqual({ key: 'people-contact-list', params: {} });
    expect(matchNetlifyApiRoute('/people/overview-evidence')).toEqual({ key: 'people-overview-evidence', params: {} });
    expect(matchNetlifyApiRoute('/people/assistance')).toEqual({ key: 'people-assistance', params: {} });
    expect(matchNetlifyApiRoute('/people/recommendations')).toEqual({ key: 'people-recommendations', params: {} });
    expect(matchNetlifyApiRoute('/import/hourglass/preview')).toEqual({ key: 'hourglass-preview', params: {} });
    expect(matchNetlifyApiRoute('/people/person-1')).toEqual({ key: 'person', params: { personId: 'person-1' } });
    expect(matchNetlifyApiRoute('/people/person-1/eligibility')).toEqual({ key: 'eligibility', params: { personId: 'person-1' } });
    expect(matchNetlifyApiRoute('/people/person-1/availability')).toEqual({ key: 'availability', params: { personId: 'person-1' } });
    expect(matchNetlifyApiRoute('/people/person-1/contact')).toEqual({ key: 'ordinary-contact', params: { personId: 'person-1' } });
    expect(matchNetlifyApiRoute('/people/person-1/availability/away-1')).toEqual({ key: 'availability-period', params: { personId: 'person-1', availabilityPeriodId: 'away-1' } });
    expect(matchNetlifyApiRoute('/responsibilities/res-1/end')).toEqual({ key: 'end-responsibility', params: { responsibilityId: 'res-1' } });
    expect(matchNetlifyApiRoute('/access/subjects/actor-1/grants')).toEqual({ key: 'subject-grants', params: { subjectId: 'actor-1' } });
    expect(matchNetlifyApiRoute('/people/%2Fetc')).toBeUndefined();
    expect(matchNetlifyApiRoute('/people/person-1/availability/%2Fetc')).toBeUndefined();
  });

  it('routes authentication and congregation settings through the central Netlify function', () => {
    expect(matchNetlifyApiRoute('/auth/otp')).toEqual({ key: 'auth-otp', params: {} });
    expect(matchNetlifyApiRoute('/auth/verify')).toEqual({ key: 'auth-verify', params: {} });
    expect(matchNetlifyApiRoute('/congregation/settings')).toEqual({ key: 'congregation-settings', params: {} });
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

  it('dispatches People recommendations to the real handler instead of returning router 404', async () => {
    const result = await handleNetlifyApiEvent({ httpMethod: 'GET', path: '/api/people/recommendations', headers: {}, queryStringParameters: {} });
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({ error: 'meetingId is required' });
  });

  it('dispatches People assistance to the real authenticated handler instead of returning router 404', async () => {
    const result = await handleNetlifyApiEvent({ httpMethod: 'GET', path: '/api/people/assistance', headers: {} });
    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body)).toEqual({ error: 'Unauthorized' });
  });

  it('dispatches People Contact List to its authenticated least-privilege handler', async () => {
    const result = await handleNetlifyApiEvent({ httpMethod: 'GET', path: '/api/people/contact-list', headers: {} });
    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body)).toEqual({ error: 'Unauthorized' });
  });

  it('dispatches Hourglass preview to the authenticated server handler without exposing a public anonymous preview', async () => {
    const result = await handleNetlifyApiEvent({
      httpMethod: 'POST', path: '/api/import/hourglass/preview', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'json', payload: { publishers: [], fsGroups: [], privileges: {} } }),
    });
    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body)).toEqual({ error: 'Unauthorized' });
  });

  it('returns safe errors for unknown routes and malformed JSON', async () => {
    const missing = await handleNetlifyApiEvent({ httpMethod: 'GET', path: '/api/not-a-route', headers: {} });
    expect(missing.statusCode).toBe(404);
    expect(JSON.parse(missing.body)).toEqual({ error: 'Not found' });

    const malformed = await handleNetlifyApiEvent({ httpMethod: 'POST', path: '/api/people', headers: { 'content-type': 'application/json' }, body: '{' });
    expect(malformed.statusCode).toBe(400);
    expect(JSON.parse(malformed.body)).toEqual({ error: 'Invalid JSON body' });
  });
});
