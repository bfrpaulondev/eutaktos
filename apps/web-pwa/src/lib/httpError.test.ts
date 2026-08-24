import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpError, buildHttpError, httpErrorKind, isAbortError, readJsonBody } from './httpError';

describe('HttpError', () => {
  it('preserves status and message', () => {
    const err = new HttpError(409, 'Conflict', 'Conflict');
    expect(err.status).toBe(409);
    expect(err.message).toBe('Conflict');
    expect(err.code).toBe('Conflict');
    expect(err.name).toBe('HttpError');
    expect(err).toBeInstanceOf(Error);
  });

  it('omits code when not provided', () => {
    const err = new HttpError(500, 'Server error');
    expect(err.code).toBeUndefined();
  });
});

describe('httpErrorKind', () => {
  it('maps 401 to auth', () => {
    expect(httpErrorKind(new HttpError(401, 'Unauthorized'))).toBe('auth');
  });
  it('maps 403 to forbidden', () => {
    expect(httpErrorKind(new HttpError(403, 'Forbidden'))).toBe('forbidden');
  });
  it('maps 404 to not-found', () => {
    expect(httpErrorKind(new HttpError(404, 'Not found'))).toBe('not-found');
  });
  it('maps 409 to conflict', () => {
    expect(httpErrorKind(new HttpError(409, 'Conflict'))).toBe('conflict');
  });
  it('maps 500 to server', () => {
    expect(httpErrorKind(new HttpError(500, 'Server error'))).toBe('server');
  });
  it('maps 503 to server', () => {
    expect(httpErrorKind(new HttpError(503, 'Service unavailable'))).toBe('server');
  });
  it('maps 400 to client', () => {
    expect(httpErrorKind(new HttpError(400, 'Bad request'))).toBe('client');
  });
  it('maps 422 to client', () => {
    expect(httpErrorKind(new HttpError(422, 'Validation error'))).toBe('client');
  });
  it('maps AbortError to network', () => {
    const abortErr = new DOMException('Aborted', 'AbortError');
    expect(httpErrorKind(abortErr)).toBe('network');
  });
  it('maps generic Error to network', () => {
    expect(httpErrorKind(new Error('fetch failed'))).toBe('network');
  });
  it('maps non-Error to network', () => {
    expect(httpErrorKind('something')).toBe('network');
  });
});

describe('isAbortError', () => {
  it('returns true for AbortError DOMException', () => {
    expect(isAbortError(new DOMException('Aborted', 'AbortError'))).toBe(true);
  });
  it('returns false for generic Error', () => {
    expect(isAbortError(new Error('not abort'))).toBe(false);
  });
  it('returns false for non-Error', () => {
    expect(isAbortError(null)).toBe(false);
  });
});

describe('buildHttpError', () => {
  it('5xx returns generic "Service temporarily unavailable" without upstream body', () => {
    const err = buildHttpError({ status: 503, body: { error: 'Internal stack trace with secret_path=/etc/passwd' }, fallbackLabel: 'Test API' });
    expect(err.status).toBe(503);
    expect(err.message).toBe('Service temporarily unavailable');
    expect(err.code).toBeUndefined();
  });

  it('5xx never exposes upstream code (privacy)', () => {
    const err = buildHttpError({ status: 500, body: { error: 'Service temporarily unavailable' }, fallbackLabel: 'Test API' });
    expect(err.status).toBe(500);
    expect(err.message).toBe('Service temporarily unavailable');
    expect(err.code).toBeUndefined();
  });

  it('401 preserves short upstream error as message and code', () => {
    const err = buildHttpError({ status: 401, body: { error: 'Unauthorized' }, fallbackLabel: 'Test API' });
    expect(err.status).toBe(401);
    expect(err.message).toBe('Unauthorized');
    expect(err.code).toBe('Unauthorized');
  });

  it('401 without body uses fallback', () => {
    const err = buildHttpError({ status: 401, body: undefined, fallbackLabel: 'Test API' });
    expect(err.status).toBe(401);
    expect(err.message).toBe('Unauthorized');
  });

  it('409 preserves short upstream error', () => {
    const err = buildHttpError({ status: 409, body: { error: 'Scheduling operation cannot be completed' }, fallbackLabel: 'Test API' });
    expect(err.status).toBe(409);
    expect(err.message).toBe('Scheduling operation cannot be completed');
    expect(err.code).toBe('Scheduling operation cannot be completed');
  });

  it('403 uses "Forbidden" fallback', () => {
    const err = buildHttpError({ status: 403, body: {}, fallbackLabel: 'Test API' });
    expect(err.status).toBe(403);
    expect(err.message).toBe('Forbidden');
  });

  it('404 uses "Not found" fallback', () => {
    const err = buildHttpError({ status: 404, body: null, fallbackLabel: 'Test API' });
    expect(err.status).toBe(404);
    expect(err.message).toBe('Not found');
  });

  it('4xx with long upstream error (>200 chars) uses fallback label', () => {
    const longErr = 'x'.repeat(201);
    const err = buildHttpError({ status: 422, body: { error: longErr }, fallbackLabel: 'Test API' });
    expect(err.status).toBe(422);
    expect(err.message).toBe('Test API request failed');
    expect(err.code).toBeUndefined();
  });

  it('4xx with non-string upstream error uses fallback', () => {
    const err = buildHttpError({ status: 400, body: { error: { nested: true } }, fallbackLabel: 'Test API' });
    expect(err.status).toBe(400);
    expect(err.message).toBe('Test API request failed');
  });

  it('Array body is handled gracefully', () => {
    const err = buildHttpError({ status: 400, body: ['not', 'an', 'object'], fallbackLabel: 'Test API' });
    expect(err.status).toBe(400);
    expect(err.message).toBe('Test API request failed');
  });

  it('2xx produces fallback (should not normally happen)', () => {
    const err = buildHttpError({ status: 200, body: {}, fallbackLabel: 'Test API' });
    expect(err.status).toBe(200);
    expect(err.message).toBe('Test API request failed');
  });
});

describe('readJsonBody', () => {
  it('returns parsed JSON when content-type is application/json', async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await readJsonBody(response);
    expect(body).toEqual({ ok: true });
  });

  it('returns undefined when content-type is text/html', async () => {
    const response = new Response('<html></html>', {
      headers: { 'Content-Type': 'text/html' },
    });
    const body = await readJsonBody(response);
    expect(body).toBeUndefined();
  });

  it('returns undefined when content-type header missing', async () => {
    const response = new Response('not json');
    const body = await readJsonBody(response);
    expect(body).toBeUndefined();
  });

  it('returns undefined when body is not valid JSON', async () => {
    const response = new Response('not json', {
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await readJsonBody(response);
    expect(body).toBeUndefined();
  });
});
