import { describe, expect, it } from 'vitest';
import { logoutCopy } from './LogoutControl';

describe('LogoutControl localization', () => {
  it('uses the active locale instead of a stale document snapshot', () => {
    expect(logoutCopy('pt-PT').action).toBe('Sair');
    expect(logoutCopy('en').action).toBe('Sign out');
    expect(logoutCopy('en-US').action).toBe('Sign out');
    expect(logoutCopy('es').action).toBe('Salir');
    expect(logoutCopy('es-ES').action).toBe('Salir');
  });

  it('localizes the logout failure message too', () => {
    expect(logoutCopy('pt-PT').failure).toContain('sessão');
    expect(logoutCopy('en').failure).toContain('session');
    expect(logoutCopy('es').failure).toContain('sesión');
  });
});
