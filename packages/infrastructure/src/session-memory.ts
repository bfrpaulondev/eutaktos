import type { SessionUnitOfWork } from '@eutaktos/application';
import { revokeSessionRecord, type SessionIdentity, type SessionRecord } from '@eutaktos/domain';

function cloneSession(session: SessionRecord): SessionRecord {
  return structuredClone(session);
}

function sameIdentity(left: SessionIdentity, right: SessionIdentity): boolean {
  return left.tenantId === right.tenantId && left.actorId === right.actorId;
}

export class InMemorySessionUnitOfWork implements SessionUnitOfWork {
  readonly #sessions = new Map<string, SessionRecord>();

  constructor(seed: readonly SessionRecord[] = []) {
    for (const session of seed) {
      if (this.#sessions.has(session.id)) throw new Error('Duplicate session id');
      this.#sessions.set(session.id, cloneSession(session));
    }
  }

  findById(sessionId: string): SessionRecord | undefined {
    const session = this.#sessions.get(sessionId);
    return session ? cloneSession(session) : undefined;
  }

  commitCreate(session: SessionRecord): SessionRecord {
    if (this.#sessions.has(session.id)) throw new Error('Duplicate session id');
    const next = cloneSession(session);
    this.#sessions.set(next.id, next);
    return cloneSession(next);
  }

  commitRotate(previous: SessionRecord, next: SessionRecord): SessionRecord {
    const stored = this.#sessions.get(previous.id);
    if (!stored) throw new Error('Session not found');
    if (this.#sessions.has(next.id)) throw new Error('Duplicate session id');
    if (!previous.revokedAt) throw new Error('Previous session must be revoked before rotation');
    if (!sameIdentity(previous, next) || !sameIdentity(stored, previous)) {
      throw new Error('Session rotation identity mismatch');
    }
    if (stored.revokedAt) throw new Error('Session already revoked');

    // Validate the full write-set before mutating either record.
    const previousClone = cloneSession(previous);
    const nextClone = cloneSession(next);
    this.#sessions.set(previousClone.id, previousClone);
    this.#sessions.set(nextClone.id, nextClone);
    return cloneSession(nextClone);
  }

  commitRevoke(session: SessionRecord): SessionRecord {
    const stored = this.#sessions.get(session.id);
    if (!stored) throw new Error('Session not found');
    if (!sameIdentity(stored, session)) throw new Error('Session identity mismatch');
    const next = cloneSession(session);
    this.#sessions.set(next.id, next);
    return cloneSession(next);
  }

  revokeAll(identity: SessionIdentity, revokedAt: string): number {
    const changes: Array<[string, SessionRecord]> = [];
    for (const [id, session] of this.#sessions) {
      if (!sameIdentity(session, identity) || session.revokedAt) continue;
      changes.push([id, cloneSession(revokeSessionRecord(session, revokedAt))]);
    }

    for (const [id, session] of changes) this.#sessions.set(id, session);
    return changes.length;
  }
}
