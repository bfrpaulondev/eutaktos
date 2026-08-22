import { describe, it, expect } from 'vitest';
import {
  createAssignmentResponse,
  transitionAssignmentResponse,
  transitionAssignmentResponseIdempotent,
  assertResponseTenant,
  normalizeAssignmentResponse,
  ASSIGNMENT_RESPONSE_STATUSES,
} from './assignment-response';

const NOW = '2026-08-21T12:00:00.000Z';
const TENANT_A = 'tenant-aaa';
const TENANT_B = 'tenant-bbb';

function makeResp() {
  return createAssignmentResponse({ id: 'ar-1', tenantId: TENANT_A, assignmentId: 'assign-1', personId: 'p1', now: NOW });
}

describe('createAssignmentResponse', () => {
  it('creates with pending status', () => {
    const r = makeResp();
    expect(r.status).toBe('pending');
    expect(r.reason).toBeNull();
    expect(r.respondedAt).toBeNull();
    expect(r.acknowledgedAt).toBeNull();
    expect(Object.isFrozen(r)).toBe(true);
  });

  it('throws on empty fields', () => {
    expect(() => createAssignmentResponse({ id: '', tenantId: TENANT_A, assignmentId: 'a', personId: 'p', now: NOW })).toThrow('responseId is required');
  });
});

describe('transitionAssignmentResponse', () => {
  it('pending → confirmed', () => {
    const r = transitionAssignmentResponse(makeResp(), 'confirmed', '2026-08-21T13:00:00.000Z');
    expect(r.status).toBe('confirmed');
    expect(r.respondedAt).toBe('2026-08-21T13:00:00.000Z');
  });

  it('pending → declined with reason', () => {
    const r = transitionAssignmentResponse(makeResp(), 'declined', NOW, { code: 'unavailable', detail: 'Away' });
    expect(r.status).toBe('declined');
    expect(r.reason?.code).toBe('unavailable');
  });

  it('pending → acknowledged', () => {
    const r = transitionAssignmentResponse(makeResp(), 'acknowledged', NOW);
    expect(r.status).toBe('acknowledged');
    expect(r.acknowledgedAt).toBe(NOW);
  });

  it('confirmed → acknowledged', () => {
    let r = makeResp();
    r = transitionAssignmentResponse(r, 'confirmed', NOW);
    r = transitionAssignmentResponse(r, 'acknowledged', NOW);
    expect(r.status).toBe('acknowledged');
  });

  it('declined → acknowledged', () => {
    let r = makeResp();
    r = transitionAssignmentResponse(r, 'declined', NOW, { code: 'sick' });
    r = transitionAssignmentResponse(r, 'acknowledged', NOW);
    expect(r.status).toBe('acknowledged');
  });

  it('rejects invalid transitions', () => {
    const r = makeResp();
    expect(() => transitionAssignmentResponse(r, 'pending', NOW)).toThrow('Invalid transition');
    // acknowledged is terminal
    let r2 = makeResp();
    r2 = transitionAssignmentResponse(r2, 'acknowledged', NOW);
    expect(() => transitionAssignmentResponse(r2, 'confirmed', NOW)).toThrow('Invalid transition');
  });

  it('acknowledged is terminal', () => {
    let r = makeResp();
    r = transitionAssignmentResponse(r, 'confirmed', NOW);
    r = transitionAssignmentResponse(r, 'acknowledged', NOW);
    expect(() => transitionAssignmentResponse(r, 'confirmed', NOW)).toThrow('Invalid transition');
  });

  it('reason.code too long', () => {
    expect(() => transitionAssignmentResponse(makeResp(), 'declined', NOW, { code: 'x'.repeat(101) })).toThrow('reason.code is too long');
  });

  it('reason.detail too long', () => {
    expect(() => transitionAssignmentResponse(makeResp(), 'declined', NOW, { code: 'ok', detail: 'x'.repeat(501) })).toThrow('reason.detail is too long');
  });

  it('reason.code empty', () => {
    expect(() => transitionAssignmentResponse(makeResp(), 'declined', NOW, { code: '  ' })).toThrow('reason.code is required');
  });
});

describe('transitionAssignmentResponseIdempotent', () => {
  it('returns same ref when already in target status', () => {
    const r = makeResp();
    expect(transitionAssignmentResponseIdempotent(r, 'pending', NOW)).toBe(r);
  });

  it('transitions when different', () => {
    const r = makeResp();
    const r2 = transitionAssignmentResponseIdempotent(r, 'confirmed', NOW);
    expect(r2.status).toBe('confirmed');
  });
});

describe('tenant isolation', () => {
  it('assertResponseTenant', () => {
    expect(() => assertResponseTenant(makeResp(), TENANT_A)).not.toThrow();
    expect(() => assertResponseTenant(makeResp(), TENANT_B)).toThrow('Cross-tenant');
  });
});

describe('normalizeAssignmentResponse', () => {
  it('normalizes valid', () => {
    const r = makeResp();
    expect(normalizeAssignmentResponse(r).id).toBe('ar-1');
  });

  it('throws on invalid status', () => {
    const bad = { ...makeResp(), status: 'unknown' } as any;
    expect(() => normalizeAssignmentResponse(bad)).toThrow('Invalid assignment response status');
  });
});

describe('ASSIGNMENT_RESPONSE_STATUSES', () => {
  it('is frozen and complete', () => {
    expect(ASSIGNMENT_RESPONSE_STATUSES).toEqual(['pending', 'confirmed', 'declined', 'acknowledged']);
    expect(Object.isFrozen(ASSIGNMENT_RESPONSE_STATUSES)).toBe(true);
  });
});


it('keeps an already confirmed response immutable on an idempotent retry', () => {
  const confirmed = transitionAssignmentResponse(makeResp(), 'confirmed', NOW, { code: 'available' });
  const retried = transitionAssignmentResponseIdempotent(confirmed, 'confirmed', '2026-08-21T13:00:00.000Z', { code: 'different' });
  expect(retried).toBe(confirmed);
  expect(retried.reason).toEqual({ code: 'available' });
});
