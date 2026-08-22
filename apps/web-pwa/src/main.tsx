import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthBoundary } from './AuthBoundary';
import { DocumentDirectionSync } from './DocumentDirectionSync';
import './styles.css';
import './section-workspace.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DocumentDirectionSync />
    <AuthBoundary>
      <App />
    </AuthBoundary>
  </React.StrictMode>,
);
