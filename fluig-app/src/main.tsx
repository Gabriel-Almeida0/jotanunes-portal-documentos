import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthFluigProvider } from './auth/AuthFluigProvider';
import './styles/tokens.css';
import './styles/base.css';
import './styles/paginas.css';

async function iniciarMocks(): Promise<void> {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return;
  const { worker } = await import('./mocks/browser');
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
}

iniciarMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthFluigProvider>
        <App />
      </AuthFluigProvider>
    </StrictMode>,
  );
});
