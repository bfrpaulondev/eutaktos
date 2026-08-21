export function resolvePwaScriptUrl(baseUrl: string, origin: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(`${normalizedBase}sw.js`, origin).toString();
}
