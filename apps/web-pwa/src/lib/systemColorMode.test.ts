import { describe, expect, it, vi } from 'vitest';
import { readSystemPrefersDark, subscribeSystemPrefersDark, SYSTEM_DARK_QUERY } from './systemColorMode';

describe('system color mode', () => {
  it('reads the current system preference', () => {
    const matchMedia = vi.fn(() => ({ matches: true }) as MediaQueryList);
    expect(readSystemPrefersDark(matchMedia)).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith(SYSTEM_DARK_QUERY);
  });

  it('reacts to changes without a reload', () => {
    let matches = false;
    const listeners = new Set<() => void>();
    const media = {
      get matches() { return matches; },
      addEventListener: (_type: string, listener: () => void) => { listeners.add(listener); },
      removeEventListener: (_type: string, listener: () => void) => { listeners.delete(listener); },
      addListener: (listener: () => void) => { listeners.add(listener); },
      removeListener: (listener: () => void) => { listeners.delete(listener); },
    } as unknown as MediaQueryList;
    const matchMedia = vi.fn(() => media);
    const observed: boolean[] = [];

    const unsubscribe = subscribeSystemPrefersDark(value => observed.push(value), matchMedia);
    expect(observed).toEqual([false]);
    matches = true;
    listeners.forEach(listener => listener());
    expect(observed).toEqual([false, true]);
    unsubscribe();
  });
});
