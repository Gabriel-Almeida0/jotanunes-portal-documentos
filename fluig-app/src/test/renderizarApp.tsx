import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { AuthFluigProvider } from '../auth/AuthFluigProvider';
import { server } from '../mocks/server';

/**
 * Renderiza o app completo (provider de sessão + roteador), como no navegador, a partir de uma rota
 * do HashRouter. Devolve as requisições feitas (método + caminho) para conferir chamadas à API.
 */
export function renderizarApp(rota = '/') {
  window.history.replaceState(null, '', `/#${rota}`);
  const requisicoes: string[] = [];
  server.events.on('request:start', ({ request }) => {
    requisicoes.push(`${request.method} ${new URL(request.url).pathname}`);
  });
  const usuario = userEvent.setup();
  const resultado = render(
    <AuthFluigProvider>
      <App />
    </AuthFluigProvider>,
  );
  return { ...resultado, usuario, requisicoes };
}

afterEach(() => {
  server.events.removeAllListeners();
});
