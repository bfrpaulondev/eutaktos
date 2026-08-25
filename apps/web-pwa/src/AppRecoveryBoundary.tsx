import { Component, type ReactNode } from 'react';
import type { Locale } from './lib/preferences';

const recoveryCopy: Record<Locale, { title: string; body: string; retry: string }> = {
  'pt-PT': {
    title: 'Não foi possível carregar esta área.',
    body: 'A aplicação encontrou um problema ao carregar os recursos desta versão. Tente novamente para obter uma cópia atualizada.',
    retry: 'Tentar novamente',
  },
  en: {
    title: 'This area could not be loaded.',
    body: 'The application had a problem loading the resources for this version. Try again to get an up-to-date copy.',
    retry: 'Try again',
  },
  es: {
    title: 'No se pudo cargar esta área.',
    body: 'La aplicación tuvo un problema al cargar los recursos de esta versión. Vuelve a intentarlo para obtener una copia actualizada.',
    retry: 'Volver a intentar',
  },
};

interface AppRecoveryBoundaryProps {
  readonly children: ReactNode;
  readonly locale: Locale;
}

interface AppRecoveryBoundaryState {
  readonly failed: boolean;
}

export class AppRecoveryBoundary extends Component<AppRecoveryBoundaryProps, AppRecoveryBoundaryState> {
  state: AppRecoveryBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppRecoveryBoundaryState {
    return { failed: true };
  }

  componentDidCatch(): void {
    window.requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
  }

  private readonly retry = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    const text = recoveryCopy[this.props.locale];
    return (
      <main
        id="main"
        tabIndex={-1}
        data-app-recovery-boundary="true"
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          color: 'CanvasText',
          background: 'Canvas',
          outline: 'none',
        }}
      >
        <section role="alert" aria-live="assertive" style={{ width: 'min(100%, 560px)', textAlign: 'center' }}>
          <h1 style={{ marginBlock: 0, fontSize: 'clamp(1.5rem, 4vw, 2.25rem)' }}>{text.title}</h1>
          <p style={{ marginBlock: '12px 20px', lineHeight: 1.6 }}>{text.body}</p>
          <button
            type="button"
            data-app-recovery-retry="true"
            onClick={this.retry}
            style={{ minHeight: 44, paddingInline: 20, borderRadius: 10, cursor: 'pointer' }}
          >
            {text.retry}
          </button>
        </section>
      </main>
    );
  }
}
