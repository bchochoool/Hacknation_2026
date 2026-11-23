import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { warmUpApi } from './api/warmup';
import { App } from './app/App';
import { ScenarioProvider } from './app/ScenarioContext';
import './styles/tokens.css';
import './styles/global.css';
import './styles/ui.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

warmUpApi();

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScenarioProvider>
        <App />
      </ScenarioProvider>
    </BrowserRouter>
  </StrictMode>,
);
