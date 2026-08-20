import { describe, expect, it } from 'vitest';
import {
  createSessionRecord,
  revokeSessionRecord,
  rotateSessionRecord,
  type SessionRecord,
} from '@eutaktos/domain';
import { InMemorySessionUnitOfWork } from './session-memory';

const policy = { idleTimeoutMs: 30 * 60 * 1000, absoluteTimeoutMs: 12 * 60 * 60 * 1000 };

function session(id: string, tenantId = 'tenant-a', actorId = 'person-a'): SessionRecord {
  return createSessionRecord({
    id,
    identity: { tenantId, actorId },
    issuedAt: '2026-08-20T17:00:00Z',
    policy,
  });
}

describe('InMemorySessionUnitOfWork', () => {
  it('returns defensive clones', () => {
    const store = new InMemorySessionUnitOfWork([session('sess-a')]);
    const first = store.findById('sess-a');
    expect(first).toBeDefined();
    if (!first) throw new Error('missing fixture');
    first.actorId = 'mutated';

    expect(store.findById('sess-a')?.actorId).toBe('person-a');
  });

  it('rejects duplicate session ids', () => {
    const store = new InMemorySessionUnitOfWork([session('sess-a')]);
    expect(() => store.commitCreate(session('sess-a', 'tenant-b', 'person-b'))).toThrow('Duplicate session id');
    expect(store.findById('sess-a')).toMatchObject({ tenantId: 'tenant-a', actorId: 'person-a' });
  });

  it('rotates atomically only for the same verified identity', () => {
    const original = session('sess-a');
    const store = new InMemorySessionUnitOfWork([original]);
    const rotated = rotateSessionRecord(original, 'sess-b', '2026-08-20T17:10:00Z');

    store.commitRotate(rotated.previous, rotated.next);
    expect(store.findById('sess-a')?.revokedAt).toBe('2026-08-20T17:10:00.000Z');
    expect(store.findById('sess-b')).toMatchObject({ tenantId: 'tenant-a', actorId: 'person-a' });
  });

  it('rejects cross-identity rotation before mutating either record', () => {
    const original = session('sess-a');
    const store = new InMemorySessionUnitOfWork([original]);
    const previous = revokeSessionRecord(original, '2026-08-20T17:10:00Z');
    const foreign = session('sess-b', 'tenant-b', 'person-a');

    expect(() => store.commitRotate(previous, foreign)).toThrow('identity mismatch');
    expect(store.findById('sess-a')?.revokedAt).toBeUndefined();
    expect(store.findById('sess-b')).toBeUndefined();
  });

  it('revokes all sessions for tenant+actor without touching same actor id in another tenant', () => {
    const store = new InMemorySessionUnitOfWork([
      session('a1'),
      session('a2'),
      session('b1', 'tenant-b', 'person-a'),
      session('c1', 'tenant-a', 'person-b'),
    ]);

    expect(store.revokeAll({ tenantId: 'tenant-a', actorId: 'person-a' }, '2026-08-20T17:20:00Z')).toBe(2);
    expect(store.findById('a1')?.revokedAt).toBe('2026-08-20T17:20:00.000Z');
    expect(store.findById('a2')?.revokedAt).toBe('2026-08-20T17:20:00.000Z');
    expect(store.findById('b1')?.revokedAt).toBeUndefined();
    expect(store.findById('c1')?.revokedAt).toBeUndefined();
  });
});
