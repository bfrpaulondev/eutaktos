import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authenticationApi } from './lib/authApi';

const AuthSignInPanel = lazy(async () => {
  const module = await import('./AuthSignInPanel');
  return { default: module.AuthSignInPanel };
});

type GateState = 'checking' | 'signed-out' | 'unavailable' | 'authenticated';

export function shouldBypassAuthentication(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]';
}

export function AuthBoundary({ children }: { children: ReactNode }) {
  const localHarness = useMemo(() => typeof window !== 'undefined' && shouldBypassAuthentication(window.location.hostname), []);
  const [state, setState] = useState<GateState>(localHarness ? 'authenticated' : 'checking');

  const checkSession = () => {
    if (localHarness) { setState('authenticated'); return () => undefined; }
    const controller = new AbortController();
    setState('checking');
    void authenticationApi.current(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setState(result.status === 'authenticated' ? 'authenticated' : result.status === 'unauthenticated' ? 'signed-out' : 'unavailable');
    });
    return () => controller.abort();
  };

  useEffect(checkSession, [localHarness]);

  if (state === 'authenticated') return <>{children}</>;

  if (state === 'checking') {
    return <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}><p role="status" aria-live="polite">A verificar sessão…</p></main>;
  }

  if (state === 'unavailable') {
    return (
      <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1>Eutaktos</h1>
          <p>Não foi possível verificar o serviço de autenticação.</p>
          <button type="button" onClick={checkSession}>Tentar novamente</button>
        </div>
      </main>
    );
  }

  return (
    <Suspense fallback={<main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}><p role="status">A preparar acesso seguro…</p></main>}>
      <AuthSignInPanel onAuthenticated={() => setState('authenticated')} />
    </Suspense>
  );
}
