import { describe, expect, it } from 'vitest';
import { classifyDisplayWindow, validateDisplayWindow, createDisplayWindow } from './display-window';

describe('classifyDisplayWindow', () => {
  it('is active with no dates', () => {
    expect(classifyDisplayWindow({ displayFrom: null, expiresAt: null })).toBe('active');
  });

  it('is upcoming when displayFrom is in the future', () => {
    expect(classifyDisplayWindow(
      { displayFrom: '2030-01-01T00:00:00Z', expiresAt: null },
      '2026-08-21T00:00:00Z',
    )).toBe('upcoming');
  });

  it('is expired when expiresAt is in the past', () => {
    expect(classifyDisplayWindow(
      { displayFrom: '2026-01-01T00:00:00Z', expiresAt: '2026-07-01T00:00:00Z' },
      '2026-08-21T00:00:00Z',
    )).toBe('expired');
  });

  it('is active within a valid window', () => {
    expect(classifyDisplayWindow(
      { displayFrom: '2026-01-01T00:00:00Z', expiresAt: '2026-12-31T00:00:00Z' },
      '2026-08-21T00:00:00Z',
    )).toBe('active');
  });

  it('is expired at the exact expiry boundary', () => {
    expect(classifyDisplayWindow(
      { displayFrom: null, expiresAt: '2026-08-21T12:00:00Z' },
      '2026-08-21T12:00:00Z',
    )).toBe('expired');
  });

  it('rejects malformed window dates and malformed evaluation instants', () => {
    expect(() => classifyDisplayWindow(
      { displayFrom: 'bad', expiresAt: null },
      '2026-08-21T00:00:00Z',
    )).toThrow('Invalid ISO date');
    expect(() => classifyDisplayWindow(
      { displayFrom: null, expiresAt: null },
      'bad',
    )).toThrow('Invalid ISO date');
  });

  it('rejects impossible windows instead of classifying corrupted data', () => {
    expect(() => classifyDisplayWindow(
      { displayFrom: '2026-12-01T00:00:00Z', expiresAt: '2026-08-01T00:00:00Z' },
      '2026-08-21T00:00:00Z',
    )).toThrow('expiresAt must be after displayFrom');
  });
});

describe('validateDisplayWindow', () => {
  it('rejects an impossible window', () => {
    expect(() => validateDisplayWindow({
      displayFrom: '2026-12-01T00:00:00Z',
      expiresAt: '2026-08-01T00:00:00Z',
    })).toThrow('expiresAt must be after displayFrom');
  });

  it('rejects invalid and non-string date values', () => {
    expect(() => validateDisplayWindow({ displayFrom: 'bad', expiresAt: null })).toThrow('Invalid ISO date');
    expect(() => validateDisplayWindow({ displayFrom: 1, expiresAt: null } as unknown as { displayFrom: string | null; expiresAt: string | null; })).toThrow('displayFrom must be an ISO date string');
  });

  it('accepts nulls and a valid window', () => {
    expect(() => validateDisplayWindow({ displayFrom: null, expiresAt: null })).not.toThrow();
    expect(() => validateDisplayWindow({
      displayFrom: '2026-08-01T00:00:00Z',
      expiresAt: '2026-12-31T00:00:00Z',
    })).not.toThrow();
  });
});

describe('createDisplayWindow', () => {
  it('creates a frozen window', () => {
    expect(Object.isFrozen(createDisplayWindow(null, null))).toBe(true);
  });

  it('rejects an impossible window', () => {
    expect(() => createDisplayWindow(
      '2026-12-01T00:00:00Z',
      '2026-08-01T00:00:00Z',
    )).toThrow('expiresAt must be after displayFrom');
  });
});
