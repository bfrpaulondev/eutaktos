import { AuthenticationError, AuthorizationError } from './_auth';
import { databaseConfigFromEnv, DatabaseNotConfiguredError, DatabaseRequestError, type DatabaseConfig } from './_db';

export interface AuthIdentityRow {
  readonly tenantId: string;
  readonly actorId: string;
  readonly email: string;
  readonly authUserId?: string;
  readonly mfaRequired: boolean;
}

export interface SupabaseOtpSession {
  readonly accessToken: string;
  readonly authUserId: string;
  readonly email: string;
  readonly aal: 'aal1' | 'aal2';
}

export interface CreatedAuthSession {
  readonly sessionId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly mfaRequired: boolean;
}

function objectRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new DatabaseRequestError(502);
  return value as Readonly<Record<string, unknown>>;
}

function exactString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new DatabaseRequestError(502);
  return value.trim();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function decodeJwtPayload(token: string): Readonly<Record<string, unknown>> {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) throw new AuthenticationError('Invalid authentication token');
  try {
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    return objectRecord(JSON.parse(Buffer.from(padded, 'base64').toString('utf8')));
  } catch {
    throw new AuthenticationError('Invalid authentication token');
  }
}

function verifiedSession(accessToken: string, rawUser: unknown, expectedEmail?: string): SupabaseOtpSession {
  const user = objectRecord(rawUser);
  const authUserId = exactString(user.id);
  const verifiedEmail = normalizeEmail(exactString(user.email));
  if (expectedEmail && verifiedEmail !== normalizeEmail(expectedEmail)) throw new AuthenticationError('Identity mismatch');
  if (user.is_anonymous === true) throw new AuthenticationError('Identity mismatch');

  const claims = decodeJwtPayload(accessToken);
  if (claims.sub !== authUserId || claims.role !== 'authenticated') throw new AuthenticationError('Identity mismatch');
  const aal = claims.aal === 'aal2' ? 'aal2' : claims.aal === 'aal1' ? 'aal1' : undefined;
  if (!aal) throw new AuthenticationError('Invalid authentication assurance');

  return Object.freeze({ accessToken, authUserId, email: verifiedEmail, aal });
}

export class SupabaseIdentityBridge {
  readonly #config?: DatabaseConfig;
  readonly #fetch: typeof fetch;

  constructor(config: DatabaseConfig | undefined = databaseConfigFromEnv(), fetcher: typeof fetch = fetch) {
    this.#config = config;
    this.#fetch = fetcher;
  }

  async identityForEmail(email: string): Promise<AuthIdentityRow | undefined> {
    const params = new URLSearchParams({
      select: 'tenant_id,actor_id,email,auth_user_id,mfa_required',
      email: `eq.${normalizeEmail(email)}`,
      enabled: 'eq.true',
      limit: '1',
    });
    const value = await this.#databaseRequest(`/rest/v1/eutaktos_auth_identities?${params}`);
    if (!Array.isArray(value)) throw new DatabaseRequestError(502);
    if (!value[0]) return undefined;
    const row = objectRecord(value[0]);
    return Object.freeze({
      tenantId: exactString(row.tenant_id),
      actorId: exactString(row.actor_id),
      email: exactString(row.email),
      ...(typeof row.auth_user_id === 'string' && row.auth_user_id.trim() ? { authUserId: row.auth_user_id.trim() } : {}),
      mfaRequired: row.mfa_required === true,
    });
  }

  async requestEmailOtp(email: string, shouldCreateUser: boolean, redirectTo?: string): Promise<void> {
    const query = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
    const response = await this.#authFetch(`/auth/v1/otp${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizeEmail(email), create_user: shouldCreateUser }),
    });
    if (!response.ok) {
      if (response.status >= 500) throw new DatabaseRequestError(response.status);
      throw new AuthenticationError('Authentication request rejected');
    }
  }

  async verifyEmailOtp(email: string, token: string): Promise<SupabaseOtpSession> {
    const response = await this.#authFetch('/auth/v1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email', email: normalizeEmail(email), token }),
    });
    if (!response.ok) {
      if (response.status >= 500) throw new DatabaseRequestError(response.status);
      throw new AuthenticationError('Invalid or expired authentication code');
    }
    let raw: unknown;
    try { raw = await response.json(); } catch { throw new DatabaseRequestError(502); }
    const body = objectRecord(raw);
    return verifiedSession(exactString(body.access_token), body.user, email);
  }

  async verifyEmailTokenHash(tokenHash: string): Promise<SupabaseOtpSession> {
    const normalized = tokenHash.trim();
    if (normalized.length < 32 || normalized.length > 512 || !/^[A-Za-z0-9_-]+$/.test(normalized)) {
      throw new AuthenticationError('Invalid or expired authentication link');
    }
    const response = await this.#authFetch('/auth/v1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email', token_hash: normalized }),
    });
    if (!response.ok) {
      if (response.status >= 500) throw new DatabaseRequestError(response.status);
      throw new AuthenticationError('Invalid or expired authentication link');
    }
    let raw: unknown;
    try { raw = await response.json(); } catch { throw new DatabaseRequestError(502); }
    const body = objectRecord(raw);
    return verifiedSession(exactString(body.access_token), body.user);
  }

  async verifyAccessToken(accessToken: string): Promise<SupabaseOtpSession> {
    const token = accessToken.trim();
    if (!token || token.length > 8192) throw new AuthenticationError('Invalid authentication token');
    const response = await this.#authFetch('/auth/v1/user', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      if (response.status >= 500) throw new DatabaseRequestError(response.status);
      throw new AuthenticationError('Invalid or expired authentication link');
    }
    let raw: unknown;
    try { raw = await response.json(); } catch { throw new DatabaseRequestError(502); }
    return verifiedSession(token, raw);
  }

  async createEutaktosSession(input: {
    readonly email: string;
    readonly authUserId: string;
    readonly sessionId: string;
    readonly authenticatedAt: string;
    readonly aal: 'aal1' | 'aal2';
  }): Promise<CreatedAuthSession> {
    try {
      const value = await this.#databaseRequest('/rest/v1/rpc/eutaktos_create_auth_session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_email: normalizeEmail(input.email),
          p_auth_user_id: input.authUserId,
          p_session_id: input.sessionId,
          p_authenticated_at: input.authenticatedAt,
          p_aal: input.aal,
        }),
      });
      if (!Array.isArray(value) || value.length !== 1) throw new DatabaseRequestError(502);
      const row = objectRecord(value[0]);
      return Object.freeze({
        sessionId: exactString(row.session_id),
        tenantId: exactString(row.tenant_id),
        actorId: exactString(row.actor_id),
        mfaRequired: row.mfa_required === true,
      });
    } catch (error) {
      if (error instanceof DatabaseRequestError && error.status === 403) throw new AuthorizationError('MFA required');
      if (error instanceof DatabaseRequestError && error.status === 401) throw new AuthenticationError('Identity not authorized');
      throw error;
    }
  }

  async #authFetch(path: string, init: RequestInit): Promise<Response> {
    const config = this.#config;
    if (!config) throw new DatabaseNotConfiguredError();
    return this.#fetch(`${config.url}${path}`, {
      ...init,
      headers: { Accept: 'application/json', apikey: config.serviceRoleKey, ...init.headers },
    });
  }

  async #databaseRequest(path: string, init: RequestInit = {}): Promise<unknown> {
    const config = this.#config;
    if (!config) throw new DatabaseNotConfiguredError();
    const headers: Record<string, string> = { Accept: 'application/json', apikey: config.serviceRoleKey };
    if (!config.serviceRoleKey.startsWith('sb_secret_')) headers.Authorization = `Bearer ${config.serviceRoleKey}`;
    const response = await this.#fetch(`${config.url}${path}`, { ...init, headers: { ...headers, ...init.headers } });
    if (!response.ok) throw new DatabaseRequestError(response.status);
    if (response.status === 204 || response.headers.get('content-length') === '0') return undefined;
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) return undefined;
    try { return await response.json(); } catch { throw new DatabaseRequestError(502); }
  }
}
