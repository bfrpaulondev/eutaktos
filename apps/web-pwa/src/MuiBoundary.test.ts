import { describe, expect, it } from 'vitest';

const sourceModules = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Readonly<Record<string, string>>;

function source(path: string): string {
  const value = sourceModules[`./${path}`];
  if (typeof value !== 'string') throw new Error(`Missing source module: ${path}`);
  return value;
}

function muiConsumers(): readonly string[] {
  return Object.entries(sourceModules)
    .filter(([path]) => !path.endsWith('/MuiBoundary.test.ts'))
    .filter(([, contents]) => /(?:from\s+|import\s*)['"]@mui\/material(?:\/[^'"]+)?['"]/.test(contents))
    .map(([path]) => path.replace(/^\.\//, ''))
    .sort();
}

describe('PX11 MUI retirement boundary', () => {
  it('rejects every direct MUI runtime consumer', () => {
    expect(muiConsumers()).toEqual([]);
  });

  it('keeps application, shell and palette authority MUI-free', () => {
    for (const file of ['App.tsx', 'TaskShell.tsx', 'theme.ts', 'ui/AntDesignFoundation.tsx']) {
      expect(source(file)).not.toContain('@mui/material');
      expect(source(file)).not.toContain('@emotion/');
    }
  });
});
