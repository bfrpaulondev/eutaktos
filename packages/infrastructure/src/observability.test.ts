import { describe, expect, it } from 'vitest';
import {
  InMemorySafeLogSink,
  SafeLogger,
  sanitizeLogMetadata,
  type SafeLogEntry,
  type SafeLogSink,
} from './observability';

describe('sanitizeLogMetadata', () => {
  it('keeps only explicitly allowlisted operational metadata', () => {
    expect(sanitizeLogMetadata({
      correlationId: 'req-123',
      requestId: 'request.456',
      routeTemplate: '/api/people/:personId',
      httpMethod: 'post',
      httpStatus: 201,
      durationMs: 12.5,
      eventType: 'PersonCreated',
      resourceType: 'person',
      operation: 'create',
      success: true,
      displayName: 'Sensitive Name',
      email: 'person@example.com',
      phone: '+351000000000',
      tenantId: 'tenant-a',
      actorId: 'person-1',
      authorization: 'Bearer secret',
      body: { notes: 'private' },
      stack: 'stack trace',
      token: 'secret',
    })).toEqual({
      correlationId: 'req-123',
      requestId: 'request.456',
      routeTemplate: '/api/people/:personId',
      httpMethod: 'POST',
      httpStatus: 201,
      durationMs: 12.5,
      eventType: 'PersonCreated',
      resourceType: 'person',
      operation: 'create',
      success: true,
    });
  });

  it('drops unsafe identifiers, raw URLs and invalid numeric values', () => {
    expect(sanitizeLogMetadata({
      correlationId: 'customer name with spaces',
      requestId: 'person@example.com',
      routeTemplate: '/api/people/person@example.com?token=x',
      httpStatus: 999,
      durationMs: -1,
      retryCount: 1.5,
      queueDepth: Number.POSITIVE_INFINITY,
      buildVersion: 'version with spaces',
    })).toEqual({});
  });
});

describe('SafeLogger', () => {
  it('writes immutable structured events without free-form PII', () => {
    const sink = new InMemorySafeLogSink();
    const logger = new SafeLogger(sink, { now: () => '2026-08-20T17:00:00.000Z' });

    logger.info('people.create.completed', {
      routeTemplate: '/api/people',
      httpMethod: 'POST',
      httpStatus: 201,
      displayName: 'Private Person',
    });

    expect(sink.entries()).toEqual([{
      level: 'info',
      event: 'people.create.completed',
      occurredAt: '2026-08-20T17:00:00.000Z',
      metadata: {
        routeTemplate: '/api/people',
        httpMethod: 'POST',
        httpStatus: 201,
      },
    }]);
    expect(Object.isFrozen(sink.entries()[0])).toBe(true);
    expect(Object.isFrozen(sink.entries()[0]?.metadata)).toBe(true);
  });

  it('logs safe error identity/code but never message or stack', () => {
    const sink = new InMemorySafeLogSink();
    const logger = new SafeLogger(sink, { now: () => '2026-08-20T17:00:00.000Z' });
    const error = Object.assign(new Error('Email person@example.com failed with token abc'), {
      code: 'DB_TIMEOUT',
    });

    logger.failure('persistence.failed', error, { operation: 'people_write' });

    const [entry] = sink.entries();
    expect(entry?.metadata).toEqual({
      errorName: 'Error',
      errorCode: 'DB_TIMEOUT',
      operation: 'people_write',
    });
    expect(JSON.stringify(entry)).not.toContain('person@example.com');
    expect(JSON.stringify(entry)).not.toContain('token abc');
    expect(entry).not.toHaveProperty('stack');
  });

  it('uses a safe fallback instead of recording an invalid event name', () => {
    const sink = new InMemorySafeLogSink();
    const logger = new SafeLogger(sink, { now: () => 'not-a-date' });

    logger.warn('User Bruno failed login', { errorCode: 'AUTH_DENIED' });

    expect(sink.entries()[0]).toMatchObject({
      event: 'invalid_event',
      occurredAt: '1970-01-01T00:00:00.000Z',
      metadata: { errorCode: 'AUTH_DENIED' },
    });
  });

  it('never lets a sink failure break the business path', () => {
    const sink: SafeLogSink = {
      write(_entry: Readonly<SafeLogEntry>) {
        throw new Error('telemetry unavailable');
      },
    };
    const logger = new SafeLogger(sink, { now: () => '2026-08-20T17:00:00.000Z' });

    expect(() => logger.error('service.failed', { errorCode: 'E_DOWN' })).not.toThrow();
  });

  it('returns a copy of in-memory entries so callers cannot append to storage', () => {
    const sink = new InMemorySafeLogSink();
    const logger = new SafeLogger(sink, { now: () => '2026-08-20T17:00:00.000Z' });
    logger.debug('cache.checked', { cacheState: 'miss' });

    const copy = sink.entries() as Readonly<SafeLogEntry>[];
    expect(Object.isFrozen(copy)).toBe(true);
    expect(sink.entries()).toHaveLength(1);
  });
});
