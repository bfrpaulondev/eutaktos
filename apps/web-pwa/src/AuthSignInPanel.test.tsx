import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AuthSignInPanel, createAuthMutationGuard } from './AuthSignInPanel';

describe('AuthSignInPanel Ant migration', () => {
  it('prevents duplicate concurrent authentication mutations', async () => {
    const guard = createAuthMutationGuard();
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const mutation = vi.fn(async () => pending);

    const first = guard(mutation);
    const second = guard(mutation);

    expect(mutation).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
  });

  it('keeps the secure-cookie privacy explanation and accessible sign-in controls', () => {
    const markup = renderToStaticMarkup(<AuthSignInPanel onAuthenticated={() => undefined} />);

    expect(markup).toMatch(/Entrar no Eutaktos|Sign in to Eutaktos|Entrar en Eutaktos/);
    expect(markup).toContain('aria-label="Email"');
    expect(markup).toContain('type="email"');
    expect(markup).toMatch(/cookie seguro|secure cookie session|cookie segura/);
    expect(markup).toMatch(/Não guardamos tokens de autenticação|Authentication tokens are not stored|No almacenamos tokens de autenticación/);
    expect(markup).not.toContain('@mui/material');
  });
});
