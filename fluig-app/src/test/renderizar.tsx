import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { FUTURO_ROUTER, RotasApp } from '../App';
import { definirTokenFluig } from '../api/client';
import { ContextoUsuarioFluig } from '../auth/contexto';
import { USUARIO_MOCK } from '../mocks/dados';

let localAtual = '';

function EspiaoLocal() {
  const location = useLocation();
  localAtual = location.pathname + location.search;
  return null;
}

/** Renderiza o app (rotas + layout) numa rota, com usuário Fluig já identificado. */
export function renderizarRota(caminho: string) {
  definirTokenFluig('token-de-teste');
  const usuario = userEvent.setup();
  const resultado = render(
    <ContextoUsuarioFluig.Provider value={USUARIO_MOCK}>
      <MemoryRouter initialEntries={[caminho]} future={FUTURO_ROUTER}>
        <RotasApp />
        <EspiaoLocal />
      </MemoryRouter>
    </ContextoUsuarioFluig.Provider>,
  );
  return { ...resultado, usuario, local: () => localAtual };
}
