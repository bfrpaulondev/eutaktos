import { describe, expect, it } from 'vitest';
import { assertTrustedBrowserMutation, isSafeHttpMethod } from './csrf-origin';

describe('cookie-authenticated mutation origin guard', () => {
  const trusted = 'https://app.eutaktos.example';

  it('allows safe methods without requiring an Origin header', () => {
    expect(() => assertTrustedBrowserMutation({ method: 'GET' }, trusted)).not.toThrow();
    expect(() => assertTrustedBrowserMutation({ method: 'head' }, trusted)).not.toThrow();
    expect(() => assertTrustedBrowserMutation({ method: 'OPTIONS' }, trusted)).not.toThrow();
    expect(isSafeHttpMethod('GET')).toBe(true);
    expect(isSafeHttpMethod('POST')).toBe(false);
  });

  it('allows a mutation only from the exact HTTPS origin', () => {
    expect(() => assertTrustedBrowserMutation({
      method: 'POST',
      origin: trusted,
      secFetchSite: 'same-origin',
    }, trusted)).not.toThrow();
  });

  it('rejects cross-origin and same-site sibling origins', () => {
    expect(() => assertTrustedBrowserMutation({
      method: 'POST', origin: 'https://evil.example', secFetchSite: 'cross-site',
    }, trusted)).toThrow('Untrusted request origin');

    expect(() => assertTrustedBrowserMutation({
      method: 'POST', origin: 'https://other.eutaktos.example', secFetchSite: 'same-site',
    }, trusted)).toThrow('Untrusted request origin');
  });

  it('rejects missing, null, malformed and path-bearing Origin values on mutations', () => {
    for (const origin of [undefined, 'null', 'not-a-url', `${trusted}/path`, `${trusted}?next=x`]) {
      expect(() => assertTrustedBrowserMutation({ method: 'PATCH', origin }, trusted)).toThrow('Untrusted request origin');
    }
  });

  it('rejects contradictory Fetch Metadata even with the correct Origin', () => {
    for (const secFetchSite of ['cross-site', 'same-site', 'none']) {
      expect(() => assertTrustedBrowserMutation({ method: 'DELETE', origin: trusted, secFetchSite }, trusted))
        .toThrow('Untrusted request origin');
    }
  });

  it('rejects unsafe trusted-origin configuration instead of deriving trust from request headers', () => {
    expect(() => assertTrustedBrowserMutation({ method: 'POST', origin: 'http://localhost' }, 'http://localhost'))
      .toThrow('Trusted origin must use HTTPS');
    expect(() => assertTrustedBrowserMutation({ method: 'POST', origin: trusted }, `${trusted}/api`))
      .toThrow('Trusted origin must contain origin only');
  });

  it('rejects malformed HTTP methods', () => {
    expect(() => isSafeHttpMethod('G ET')).toThrow('Invalid HTTP method');
  });
});
