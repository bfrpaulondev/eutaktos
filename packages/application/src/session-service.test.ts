import { describe, expect, it } from 'vitest';
import type { SessionIdentity, SessionRecord } from '@eutaktos/domain';
import { SessionService, type SessionRuntime, type SessionUnitOfWork } from './session-service';

class FakeSessionUnitOfWork implements SessionUnitOfWork {
  readonly sessions = new Map<string, SessionRecord>();
  rotations = 0;
  revocations = 0;

  findById(sessionId: string): SessionRecord | undefined {
    const value = this.sessions.get(sessionId);
    return value ? structuredClone(value) : undefined;
  }

  commitCreate(session: SessionRecord): SessionRecord {
    if (this.sessions.has(session.id)) throw new Error('duplicate session id');
    this.sessions.set(session.id, structuredClone(session));
    return structuredClone(session);
  }

  commitRotate(previous: SessionRecord, next: SessionRecord): SessionRecord {
    if (!this.sessions.has(previous.id) || this.sessions.has(next.id)) throw new Error('invalid rotation');
    this.sessions.set(previous.id, structuredClone(previous));
    this.sessions.set(next.id, structuredClone(next));
    this.rotations += 1;
    return structuredClone(next);
  }

  commitRevoke(session: SessionRecord): SessionRecord {
    if (!this.sessions.has(session.id)) throw new Error('missing session');
    this.sessions.set(session.id, structuredClone(session));
    this.revocations += 1;
    return structuredClone(session);
  }

  revokeAll(identity: SessionIdentity, revokedAt: string): number {
    let count = 0;
    for (const [id, session] of this.sessions) {
      if (session.tenantId !== identity.tenantId || session.actorId !== identity.actorId || session.revokedAt) continue;
      this.sessions.set(id, { ...session, revokedAt });
      count += 1;
    }
    return count;
  }
}

function runtime(initial = '2026-08-20T17:00:00.000Z'): SessionRuntime & { setNow(value: string): void } {
  let now = initial;
  let next = 0;
  return {
    now: () => now,
    nextSessionId: () => `sess-${++next}`,
    setNow: value => { now = value; },
  };
}

const policy = { idleTimeoutMs: 30 * 60 * 1000, absoluteTimeoutMs: 12 * 60 * 60 * 1000 };
const identity = { tenantId: 'tenant-a', actorId: 'person-a' };

describe('SessionService', () => {
  it('issues and resolves verified identity without persisting capabilities', () => {
    const unitOfWork = new FakeSessionUnitOfWork();
    const service = new SessionService(unitOfWork, runtime(), policy);
    const issued = service.issue(identity);

    expect(issued.id).toBe('sess-1');
    expect(service.resolve(issued.id)).toEqual(identity);
    expect(unitOfWork.sessions.get(issued.id)).not.toHaveProperty('capabilities');
  });

  it('does not resolve expired or revoked sessions', () => {
    const clock = runtime();
    const service = new SessionService(new FakeSessionUnitOfWork(), clock, policy);
    const issued = service.issue(identity);

    clock.setNow('2026-08-20T17:30:00.000Z');
    expect(service.resolve(issued.id)).toBeUndefined();
  });

  it('rotates active sessions atomically and invalidates the previous id', () => {
    const clock = runtime();
    const unitOfWork = new FakeSessionUnitOfWork();
    const service = new SessionService(unitOfWork, clock, policy);
    const issued = service.issue(identity);
    clock.setNow('2026-08-20T17:10:00.000Z');

    const rotated = service.rotate(issued.id);
    expect(rotated?.id).toBe('sess-2');
    expect(unitOfWork.rotations).toBe(1);
    expect(service.resolve(issued.id)).toBeUndefined();
    expect(service.resolve('sess-2')).toEqual(identity);
  });

  it('does not rotate an expired session', () => {
    const clock = runtime();
    const unitOfWork = new FakeSessionUnitOfWork();
    const service = new SessionService(unitOfWork, clock, policy);
    const issued = service.issue(identity);
    clock.setNow('2026-08-20T17:31:00.000Z');

    expect(service.rotate(issued.id)).toBeUndefined();
    expect(unitOfWork.rotations).toBe(0);
  });

  it('revokes idempotently', () => {
    const unitOfWork = new FakeSessionUnitOfWork();
    const service = new SessionService(unitOfWork, runtime(), policy);
    const issued = service.issue(identity);

    expect(service.revoke(issued.id)).toBe(true);
    expect(service.revoke(issued.id)).toBe(false);
    expect(unitOfWork.revocations).toBe(1);
  });

  it('revokes all sessions for the exact tenant+actor identity only', () => {
    const unitOfWork = new FakeSessionUnitOfWork();
    const clock = runtime();
    const service = new SessionService(unitOfWork, clock, policy);
    const a1 = service.issue(identity);
    const a2 = service.issue(identity);
    const otherTenant = service.issue({ tenantId: 'tenant-b', actorId: 'person-a' });
    const otherActor = service.issue({ tenantId: 'tenant-a', actorId: 'person-b' });

    expect(service.revokeAll(identity)).toBe(2);
    expect(service.resolve(a1.id)).toBeUndefined();
    expect(service.resolve(a2.id)).toBeUndefined();
    expect(service.resolve(otherTenant.id)).toEqual({ tenantId: 'tenant-b', actorId: 'person-a' });
    expect(service.resolve(otherActor.id)).toEqual({ tenantId: 'tenant-a', actorId: 'person-b' });
  });
});
