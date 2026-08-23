import { parseCurrentSession, type CurrentSessionDto } from './sessionApi';

export type AuthenticationSessionState =
  | Readonly<{ status: 'authenticated'; session: CurrentSessionDto }>
  | Readonly<{ status: 'unauthenticated' }>
  | Readonly<{ status: 'unavailable' }>;

export class AuthenticationApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AuthenticationApiError';
    this.status = status;
  }
}

async function optionalJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) return undefined;
  try { return await response.json(); }
  catch { return undefined; }
}

function safeServerError(response: Response, body: unknown): AuthenticationApiError {
  const error = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as { error?: unknown }).error
    : undefined;
  const message = response.status >= 400 && response.status < 500 && typeof error === 'string' && error.length <= 120
    ? error
    : 'Authentication service unavailable';
  return new AuthenticationApiError(response.status, message);
}

export function isSupabaseAuthHash(hash: string): boolean {
  if (!hash.startsWith('#')) return false;
  const params = new URLSearchParams(hash.slice(1));
  return params.has('access_token') || params.has('refresh_token') || params.has('error') || params.has('error_code') || params.has('error_description');
}

export function supabaseAccessTokenFromHash(hash: string): string | undefined {
  if (!hash.startsWith('#')) return undefined;
  const params = new URLSearchParams(hash.slice(1));
  const token = params.get('access_token')?.trim();
  const tokenType = params.get('token_type')?.trim().toLowerCase();
  if (!token || tokenType !== 'bearer' || token.length > 8192 || token.split('.').length !== 3) return undefined;
  return token;
}

export function createAuthenticationApi(fetcher: typeof fetch = fetch) {
  return Object.freeze({
    async current(signal?: AbortSignal): Promise<AuthenticationSessionState> {
      try {
        const response = await fetcher('/api/session', {
          method: 'GET',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          signal,
        });
        if (response.status === 401) return Object.freeze({ status: 'unauthenticated' as const });
        if (!response.ok) return Object.freeze({ status: 'unavailable' as const });
        const body = await optionalJson(response);
        return Object.freeze({ status: 'authenticated' as const, session: parseCurrentSession(body) });
      } catch {
        return Object.freeze({ status: 'unavailable' as const });
      }
    },

    async requestOtp(email: string): Promise<void> {
      const response = await fetcher('/api/auth/otp', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await optionalJson(response);
      if (!response.ok) throw safeServerError(response, body);
    },

    async verifyOtp(email: string, token: string): Promise<CurrentSessionDto> {
      const response = await fetcher('/api/auth/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token }),
      });
      const body = await optionalJson(response);
      if (!response.ok) throw safeServerError(response, body);
      return parseCurrentSession(body);
    },

    async verifyMagicLink(accessToken: string, signal?: AbortSignal): Promise<CurrentSessionDto> {
      const response = await fetcher('/api/auth/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
        signal,
      });
      const body = await optionalJson(response);
      if (!response.ok) throw safeServerError(response, body);
      return parseCurrentSession(body);
    },

    async logout(): Promise<void> {
      const response = await fetcher('/api/session/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (response.status === 401) return;
      if (!response.ok) {
        const body = await optionalJson(response);
        throw safeServerError(response, body);
      }
    },
  });
}

export const authenticationApi = createAuthenticationApi();