import {
  createSessionRecord,
  isSessionActiveAt,
  revokeSessionRecord,
  rotateSessionRecord,
  sessionIdentity,
  type SessionId,
  type SessionIdentity,
  type SessionPolicy,
  type SessionRecord,
} from '@eutaktos/domain';

/**
 * Identity supplied here must already have been verified by an authentication
 * provider/server boundary. Frontend claims are never accepted as verified identity.
 */
export type VerifiedAuthenticationIdentity = Readonly<SessionIdentity>;

export interface SessionUnitOfWork {
  findById(sessionId: SessionId): SessionRecord | undefined;
  commitCreate(session: SessionRecord): SessionRecord;
  commitRotate(previous: SessionRecord, next: SessionRecord): SessionRecord;
  commitRevoke(session: SessionRecord): SessionRecord;
  revokeAll(identity: SessionIdentity, revokedAt: string): number;
}

export interface SessionRuntime {
  now(): string;
  nextSessionId(): SessionId;
}

export class SessionService {
  readonly #unitOfWork: SessionUnitOfWork;
  readonly #runtime: SessionRuntime;
  readonly #policy: SessionPolicy;

  constructor(unitOfWork: SessionUnitOfWork, runtime: SessionRuntime, policy: SessionPolicy) {
    this.#unitOfWork = unitOfWork;
    this.#runtime = runtime;
    this.#policy = policy;
  }

  issue(identity: VerifiedAuthenticationIdentity): SessionRecord {
    const session = createSessionRecord({
      id: this.#runtime.nextSessionId(),
      identity,
      issuedAt: this.#runtime.now(),
      policy: this.#policy,
    });
    return this.#unitOfWork.commitCreate(session);
  }

  /**
   * Resolves identity only. Capabilities are intentionally absent from sessions and
   * must be loaded/derived by the authorization layer for the current request.
   */
  resolve(sessionId: SessionId): Readonly<SessionIdentity> | undefined {
    const session = this.#unitOfWork.findById(sessionId);
    if (!session || !isSessionActiveAt(session, this.#runtime.now())) return undefined;
    return sessionIdentity(session);
  }

  rotate(sessionId: SessionId): SessionRecord | undefined {
    const current = this.#unitOfWork.findById(sessionId);
    if (!current) return undefined;
    const now = this.#runtime.now();
    if (!isSessionActiveAt(current, now)) return undefined;

    const rotated = rotateSessionRecord(current, this.#runtime.nextSessionId(), now);
    return this.#unitOfWork.commitRotate(rotated.previous, rotated.next);
  }

  revoke(sessionId: SessionId): boolean {
    const current = this.#unitOfWork.findById(sessionId);
    if (!current || current.revokedAt) return false;
    this.#unitOfWork.commitRevoke(revokeSessionRecord(current, this.#runtime.now()));
    return true;
  }

  revokeAll(identity: VerifiedAuthenticationIdentity): number {
    return this.#unitOfWork.revokeAll(identity, this.#runtime.now());
  }
}
