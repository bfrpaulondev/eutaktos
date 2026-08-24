import { databaseConfigFromEnv, DatabaseNotConfiguredError, DatabaseRequestError, type DatabaseConfig } from './_db';

declare const process: { env: Record<string, string | undefined> };

export interface CreatedPilotAccessSession {
  readonly sessionId: string;
  readonly tenantId: string;
  readonly actorId: string;
}

export function temporaryPilotAccessCodesEnabled(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.EUTAKTOS_ENABLE_TEMPORARY_PILOT_ACCESS_CODES?.trim().toLowerCase() === 'true';
}

function exactString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new DatabaseRequestError(502);
  return value.trim();
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function consumeTemporaryPilotAccessCode(
  input: {
    readonly email: string;
    readonly code: string;
    readonly sessionId: string;
    readonly authenticatedAt: string;
  },
  config: DatabaseConfig | undefined = databaseConfigFromEnv(),
  fetcher: typeof fetch = fetch,
): Promise<CreatedPilotAccessSession | undefined> {
  if (!config) throw new DatabaseNotConfiguredError();
  const codeHash = await sha256Hex(input.code);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    apikey: config.serviceRoleKey,
  };
  if (!config.serviceRoleKey.startsWith('sb_secret_')) headers.Authorization = `Bearer ${config.serviceRoleKey}`;

  const response = await fetcher(`${config.url}/rest/v1/rpc/eutaktos_consume_pilot_access_code`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_email: input.email.trim().toLowerCase(),
      p_code_hash: codeHash,
      p_session_id: input.sessionId,
      p_authenticated_at: input.authenticatedAt,
    }),
  });
  if (!response.ok) throw new DatabaseRequestError(response.status);

  let value: unknown;
  try { value = await response.json(); }
  catch { throw new DatabaseRequestError(502); }
  if (!Array.isArray(value)) throw new DatabaseRequestError(502);
  if (value.length === 0) return undefined;
  if (value.length !== 1 || !value[0] || typeof value[0] !== 'object' || Array.isArray(value[0])) throw new DatabaseRequestError(502);
  const row = value[0] as Readonly<Record<string, unknown>>;
  return Object.freeze({
    sessionId: exactString(row.session_id),
    tenantId: exactString(row.tenant_id),
    actorId: exactString(row.actor_id),
  });
}
