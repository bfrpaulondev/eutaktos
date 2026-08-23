import { describe, expect, it } from 'vitest';
import { shouldBypassAuthentication } from './AuthBoundary';

describe('AuthBoundary local harness bypass', () => {
  it.each(['localhost', '127.0.0.1', '::1', '[::1]'])('allows only loopback host %s', host => {
    expect(shouldBypassAuthentication(host)).toBe(true);
  });

  it.each(['rainbow-zuccutto-00d981.netlify.app', 'eutakes.netlify.app', 'example.com', 'localhost.example.com'])('never bypasses real host %s', host => {
    expect(shouldBypassAuthentication(host)).toBe(false);
  });
});
