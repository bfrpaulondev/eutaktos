import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authenticationApi, isSupabaseAuthHash, scannerSafeMagicLinkTokenHash, supabaseAccessTokenFromHash } from './lib/authApi';

const AuthSignInPanel = lazy(async () => {
  const module = await import('./AuthSignInPanel');
  return { default: module.AuthSignInPanel };
});

const MagicLinkConfirmationPanel = lazy(async () => {
  const module = await import('./MagicLinkConfirmationPanel');
  return { default: module.MagicLinkConfirmationPanel };
});

type GateState = 'checking' | 'signed-out' | 'unavailable' | 'confirm-link' | 'authenticated';

export function shouldBypassAuthentication(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]';
}

export function scannerSafeCallback(pathname: string, search: string): string | undefined {
  return scannerSafeMagicLinkTokenHash(pathname, search);
}

export function AuthBoundary({ children }: { children: ReactNode }) {
  const localHarness = useMemo(() => typeof window !== 'undefined' && shouldBypassAuthentication(window.location.hostname), []);
  const [state, setState] = useState<GateState>(localHarness ? 'authenticated' : 'checking');
  const [pendingTokenHash, setPendingTokenHash] = useState<string>();

  const checkSession = () => {
    if (localHarness) { setState('authenticated'); return; }
    setState('checking');
    void authenticationApi.current().then(result => {
      setState(result.status === 'authenticated' ? 'authenticated' : result.status === 'unauthenticated' ? 'signed-out' : 'unavailable');
    });
  };

  useEffect(() => {
    if (localHarness) { setState('authenticated'); return undefined; }

    const controller = new AbortController();
    setState('checking');

    const tokenHash = scannerSafeCallback(window.location.pathname, window.location.search);
    if (tokenHash) {
      setPendingTokenHash(tokenHash);
      window.history.replaceState(window.history.state, '', '/auth/confirm');
      setState('confirm-link');
      return () => controller.abort();
    }

    const hash = window.location.hash;
    const magicLinkAccessToken = supabaseAccessTokenFromHash(hash);
    if (isSupabaseAuthHash(hash)) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
    }

    if (magicLinkAccessToken) {
      void authenticationApi.verifyMagicLink(magicLinkAccessToken, controller.signal).then(() => {
        if (!controller.signal.aborted) setState('authenticated');
      }).catch(() => {
        if (!controller.signal.aborted) setState('signed-out');
      });
    } else {
      void authenticationApi.current(controller.signal).then(result => {
        if (controller.signal.aborted) return;
        setState(result.status === 'authenticated' ? 'authenticated' : result.status === 'unauthenticated' ? 'signed-out' : 'unavailable');
      });
    }

    return () => controller.abort();
  }, [localHarness]);

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

  if (state === 'confirm-link' && pendingTokenHash) {
    return (
      <Suspense fallback={<main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}><p role="status">A preparar confirmação segura…</p></main>}>
        <MagicLinkConfirmationPanel
          tokenHash={pendingTokenHash}
          onAuthenticated={() => {
            setPendingTokenHash(undefined);
            window.history.replaceState(window.history.state, '', '/');
            setState('authenticated');
          }}
          onCancel={() => {
            setPendingTokenHash(undefined);
            window.history.replaceState(window.history.state, '', '/');
            setState('signed-out');
          }}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}><p role="status">A preparar acesso seguro…</p></main>}>
      <AuthSignInPanel onAuthenticated={() => setState('authenticated')} />
    </Suspense>
  );
}
