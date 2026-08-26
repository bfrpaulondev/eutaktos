import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('./styles.css', import.meta.url)), 'utf8');

describe('C6 responsive overflow contract', () => {
  it('keeps the desktop task content inside its declared width', () => {
    expect(css).toContain('.ant-layout-content,\n#main {');
    expect(css).toMatch(/\.ant-layout-content,[\s\S]*?#main \{[\s\S]*?box-sizing: border-box;[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%;/);
  });

  it('allows recommendation evidence to wrap instead of widening mobile documents', () => {
    expect(css).toContain("section[aria-labelledby^='recommendation-picker-'] .ant-card-head-wrapper");
    expect(css).toMatch(/recommendation-picker-[\s\S]*?\.ant-card-head-wrapper \{[\s\S]*?flex-wrap: wrap;/);
    expect(css).toMatch(/recommendation-picker-[\s\S]*?\.ant-tag \{[\s\S]*?white-space: normal;[\s\S]*?overflow-wrap: anywhere;/);
    expect(css).toMatch(/\.ant-card-extra \{[\s\S]*?margin-inline-start: 0;/);
  });
});
