export type SecurityHeaderMap = Readonly<Record<string, string>>;

const BASE_SECURITY_HEADERS: SecurityHeaderMap = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
});

const DOCUMENT_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  // MUI/Emotion currently emits runtime style elements. Inline script remains forbidden;
  // style-src is the only directive allowing inline content until CSP nonces are wired.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "media-src 'self'",
  "upgrade-insecure-requests",
].join('; ');

export function documentSecurityHeaders(): SecurityHeaderMap {
  return Object.freeze({
    ...BASE_SECURITY_HEADERS,
    'Content-Security-Policy': DOCUMENT_CSP,
  });
}

/**
 * Protected API responses must never be persisted by browser/shared caches. The
 * API policy deliberately omits a document CSP because it is not an HTML surface.
 */
export function protectedApiSecurityHeaders(): SecurityHeaderMap {
  return Object.freeze({
    ...BASE_SECURITY_HEADERS,
    'Cache-Control': 'no-store, private',
    Pragma: 'no-cache',
  });
}

/**
 * Authentication/session endpoints receive the same no-store policy plus a
 * conservative legacy cache expiry for intermediaries that ignore Cache-Control.
 */
export function authenticationSecurityHeaders(): SecurityHeaderMap {
  return Object.freeze({
    ...protectedApiSecurityHeaders(),
    Expires: '0',
  });
}
