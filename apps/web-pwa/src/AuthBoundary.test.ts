import { describe, expect, it } from 'vitest';
import { scannerSafeCallback, shouldBypassAuthentication } from './AuthBoundary';

describe('AuthBoundary local harness bypass', () => {
  it.each(['localhost', '127.0.0.1', '::1', '[::1]'])('allows only loopback host %s', host => {
    expect(shouldBypassAuthentication(host)).toBe(true);
  });

  it.each(['rainbow-zuccutto-00d981.netlify.app', 'eutakes.netlify.app', 'example.com', 'localhost.example.com'])('never bypasses real host %s', host => {
    expect(shouldBypassAuthentication(host)).toBe(false);
  });
});

describe('scanner-safe magic-link callback', () => {
  const tokenHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  it('recognizes only the dedicated email confirmation route', () => {
    expect(scannerSafeCallback('/auth/confirm', `?token_hash=${tokenHash}&type=email`)).toBe(tokenHash);
    expect(scannerSafeCallback('/', `?token_hash=${tokenHash}&type=email`)).toBeUndefined();
    expect(scannerSafeCallback('/auth/confirm', `?token_hash=${tokenHash}&type=recovery`)).toBeUndefined();
  });

  it('rejects malformed token hashes before they can reach the API', () => {
    expect(scannerSafeCallback('/auth/confirm', '?token_hash=too-short&type=email')).toBeUndefined();
    expect(scannerSafeCallback('/auth/confirm', `?token_hash=${'a'.repeat(513)}&type=email`)).toBeUndefined();
  });
});
