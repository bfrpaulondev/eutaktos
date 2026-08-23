import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DocumentDirectionSync } from './DocumentDirectionSync';
import './styles.css';
import './section-workspace.css';

const AuthBoundary = React.lazy(async () => {
  const module = await import('./AuthBoundary');
  return { default: module.AuthBoundary };
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DocumentDirectionSync />
    <React.Suspense fallback={<main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}><p role="status">A preparar acesso seguro…</p></main>}>
      <AuthBoundary>
        <App />
      </AuthBoundary>
    </React.Suspense>
  </React.StrictMode>,
);
