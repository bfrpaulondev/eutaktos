export type TextDirection = 'ltr' | 'rtl';

const RTL_LANGUAGES = new Set([
  'ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'ku', 'nqo', 'ps', 'sd', 'syr', 'ug', 'ur', 'yi',
]);

export function textDirectionForLocale(locale: string): TextDirection {
  const candidate = locale.trim();
  if (!candidate) return 'ltr';

  try {
    const language = new Intl.Locale(candidate).language.toLowerCase();
    return RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
  } catch {
    const language = candidate.split(/[-_]/, 1)[0]?.toLowerCase() ?? '';
    return RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
  }
}

export interface DirectionalDocumentRoot {
  lang: string;
  dir: string;
}

export function syncDocumentDirection(root: DirectionalDocumentRoot): TextDirection {
  const direction = textDirectionForLocale(root.lang);
  root.dir = direction;
  return direction;
}
