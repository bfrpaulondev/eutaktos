export interface BrowserRequestMetadata {
  method: string;
  origin?: string;
  secFetchSite?: string;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function normalizedMethod(value: string): string {
  const method = value.trim().toUpperCase();
  if (!/^[A-Z]{3,10}$/.test(method)) throw new Error('Invalid HTTP method');
  return method;
}

function trustedOrigin(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Trusted origin must be a valid URL');
  }

  if (parsed.protocol !== 'https:') throw new Error('Trusted origin must use HTTPS');
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Trusted origin must contain origin only');
  }
  return parsed.origin;
}

function requestOrigin(value: string | undefined): string | undefined {
  if (!value || value === 'null') return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return undefined;
    return parsed.origin;
  } catch {
    return undefined;
  }
}

/**
 * Cookie-authenticated browser mutations must originate from the exact configured
 * application origin. The trusted origin is server configuration, never Host or
 * X-Forwarded-Host supplied by the request. `Sec-Fetch-Site`, when present, must
 * also say same-origin. This is defense-in-depth on top of SameSite cookies.
 */
export function assertTrustedBrowserMutation(
  request: BrowserRequestMetadata,
  configuredTrustedOrigin: string,
): void {
  const method = normalizedMethod(request.method);
  if (SAFE_METHODS.has(method)) return;

  const expected = trustedOrigin(configuredTrustedOrigin);
  const actual = requestOrigin(request.origin);
  if (!actual || actual !== expected) throw new Error('Untrusted request origin');

  if (request.secFetchSite !== undefined) {
    const site = request.secFetchSite.trim().toLowerCase();
    if (site !== 'same-origin') throw new Error('Untrusted request origin');
  }
}

export function isSafeHttpMethod(method: string): boolean {
  return SAFE_METHODS.has(normalizedMethod(method));
}
