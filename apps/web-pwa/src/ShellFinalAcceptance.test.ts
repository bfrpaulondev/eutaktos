import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(file: string): string {
  return readFileSync(new URL(file, import.meta.url), 'utf8');
}

describe('final shell acceptance regressions', () => {
  it('mounts the app before logout so the TaskShell skip link is the first interactive control', () => {
    const main = source('./main.tsx');
    const appIndex = main.indexOf('<App />');
    const logoutIndex = main.indexOf('<LogoutControl />');
    expect(appIndex).toBeGreaterThan(-1);
    expect(logoutIndex).toBeGreaterThan(-1);
    expect(appIndex).toBeLessThan(logoutIndex);
  });

  it('keeps the skip link before navigation inside TaskShell', () => {
    const shell = source('./TaskShell.tsx');
    const skipIndex = shell.indexOf('className="skip-link"');
    const navigationIndex = shell.indexOf('<Sider');
    expect(skipIndex).toBeGreaterThan(-1);
    expect(navigationIndex).toBeGreaterThan(-1);
    expect(skipIndex).toBeLessThan(navigationIndex);
  });
});
