import { describe, expect, it } from 'vitest';
import {
  authenticationSecurityHeaders,
  documentSecurityHeaders,
  protectedApiSecurityHeaders,
} from './security-headers';

function expectBaseline(headers: Readonly<Record<string, string>>) {
  expect(headers['X-Content-Type-Options']).toBe('nosniff');
  expect(headers['Referrer-Policy']).toBe('no-referrer');
  expect(headers['X-Frame-Options']).toBe('DENY');
  expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
  expect(headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
  expect(headers['Strict-Transport-Security']).toContain('max-age=31536000');
  expect(headers['Permissions-Policy']).toContain('camera=()');
  expect(headers['Permissions-Policy']).toContain('microphone=()');
}

describe('security response headers', () => {
  it('provides a locked-down document CSP without unsafe script execution', () => {
    const headers = documentSecurityHeaders();
    expectBaseline(headers);
    const csp = headers['Content-Security-Policy'] ?? '';

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain(' *');
    expect(Object.isFrozen(headers)).toBe(true);
  });

  it('allows inline styles only for the current MUI/Emotion runtime', () => {
    const csp = documentSecurityHeaders()['Content-Security-Policy'] ?? '';
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp.match(/'unsafe-inline'/g)).toHaveLength(1);
  });

  it('marks protected API responses private and non-cacheable', () => {
    const headers = protectedApiSecurityHeaders();
    expectBaseline(headers);
    expect(headers['Cache-Control']).toBe('no-store, private');
    expect(headers.Pragma).toBe('no-cache');
    expect(headers).not.toHaveProperty('Content-Security-Policy');
  });

  it('adds legacy no-cache expiry to authentication responses', () => {
    const headers = authenticationSecurityHeaders();
    expectBaseline(headers);
    expect(headers['Cache-Control']).toBe('no-store, private');
    expect(headers.Expires).toBe('0');
  });

  it('returns fresh immutable header maps so consumers cannot poison future responses', () => {
    const first = documentSecurityHeaders();
    const second = documentSecurityHeaders();
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
    expect(Object.isFrozen(first)).toBe(true);
  });
});
