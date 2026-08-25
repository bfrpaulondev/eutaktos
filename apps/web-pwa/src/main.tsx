import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DocumentDirectionSync } from './DocumentDirectionSync';
import { LogoutControl } from './LogoutControl';
import { AntDesignFoundation } from './ui/AntDesignFoundation';
import './styles.css';
import './section-workspace.css';

const AuthBoundary = React.lazy(async () => {
  const module = await import('./AuthBoundary');
  return { default: module.AuthBoundary };
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AntDesignFoundation>
      <DocumentDirectionSync />
      <React.Suspense fallback={<main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}><p role="status">A preparar acesso seguro…</p></main>}>
        <AuthBoundary>
          <LogoutControl />
          <App />
        </AuthBoundary>
      </React.Suspense>
    </AntDesignFoundation>
  </React.StrictMode>,
);
