import { describe, expect, it, vi } from 'vitest';
import { resolveExistingSessionGate, scannerSafeCallback, shouldBypassAuthentication } from './AuthBoundary';

describe('AuthBoundary local harness bypass', () => {
  it.each(['localhost', '127.0.0.1', '::1', '[::1]'])('allows only loopback host %s', host => {
    expect(shouldBypassAuthentication(host)).toBe(true);
  });

  it.each(['rainbow-zuccutto-00d981.netlify.app', 'eutakes.netlify.app', 'example.com', 'localhost.example.com'])('never bypasses real host %s', host => {
    expect(shouldBypassAuthentication(host)).toBe(false);
  });
});

describe('existing authenticated session activation', () => {
  it('rotates a restored authenticated session before allowing app access', async () => {
    const current = vi.fn().mockResolvedValue({
      status: 'authenticated' as const,
      session: { actorId: 'person-a', capabilities: [] },
    });
    const rotate = vi.fn().mockResolvedValue(undefined);

    await expect(resolveExistingSessionGate(undefined, current, rotate)).resolves.toBe('authenticated');
    expect(current).toHaveBeenCalledTimes(1);
    expect(rotate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['unauthenticated', 'signed-out'],
    ['unavailable', 'unavailable'],
  ] as const)('does not rotate when the session probe is %s', async (status, expected) => {
    const current = vi.fn().mockResolvedValue({ status });
    const rotate = vi.fn().mockResolvedValue(undefined);

    await expect(resolveExistingSessionGate(undefined, current, rotate)).resolves.toBe(expected);
    expect(rotate).not.toHaveBeenCalled();
  });

  it('fails closed when an authenticated session cannot be rotated', async () => {
    const current = vi.fn().mockResolvedValue({
      status: 'authenticated' as const,
      session: { actorId: 'person-a', capabilities: [] },
    });
    const rotate = vi.fn().mockRejectedValue(new Error('rotation failed'));

    await expect(resolveExistingSessionGate(undefined, current, rotate)).rejects.toThrow('rotation failed');
  });

  it('does not start a rotation when the owning session check has already been aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const current = vi.fn().mockResolvedValue({
      status: 'authenticated' as const,
      session: { actorId: 'person-a', capabilities: [] },
    });
    const rotate = vi.fn().mockResolvedValue(undefined);

    await expect(resolveExistingSessionGate(controller.signal, current, rotate)).rejects.toMatchObject({ name: 'AbortError' });
    expect(rotate).not.toHaveBeenCalled();
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
