import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PwaUpdateRecovery } from './PwaUpdateRecovery';
import './styles.css';
import './section-workspace.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <PwaUpdateRecovery />
  </React.StrictMode>,
);
