import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { startUpdateChecks } from './app/updates';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

startUpdateChecks();
