import { useEffect, useState } from 'react';

export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

type MatchMedia = (query: string) => MediaQueryList;

function browserMatchMedia(): MatchMedia | undefined {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
  return window.matchMedia.bind(window);
}

export function readSystemPrefersDark(matchMedia: MatchMedia | undefined = browserMatchMedia()): boolean {
  return matchMedia ? matchMedia(SYSTEM_DARK_QUERY).matches : false;
}

export function subscribeSystemPrefersDark(
  listener: (prefersDark: boolean) => void,
  matchMedia: MatchMedia | undefined = browserMatchMedia(),
): () => void {
  if (!matchMedia) {
    listener(false);
    return () => undefined;
  }

  const media = matchMedia(SYSTEM_DARK_QUERY);
  const update = () => listener(media.matches);
  update();

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }

  media.addListener(update);
  return () => media.removeListener(update);
}

export function useSystemPrefersDark(): boolean {
  const [prefersDark, setPrefersDark] = useState(() => readSystemPrefersDark());
  useEffect(() => subscribeSystemPrefersDark(setPrefersDark), []);
  return prefersDark;
}
