import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
import { FUTURO_ROUTER, RotasApp } from '../App';
import { definirTokenFluig } from '../api/client';
import { ContextoUsuarioFluig } from '../auth/contexto';
import { usuarioMock } from '../mocks/dados';

let localAtual = '';
let navegarAtual: NavigateFunction | null = null;

function EspiaoLocal() {
  const location = useLocation();
  localAtual = location.pathname + location.search;
  navegarAtual = useNavigate();
  return null;
}

/** Renderiza o app (rotas + layout) numa rota, com usuário Fluig já identificado. */
export function renderizarRota(caminho: string) {
  definirTokenFluig('token-de-teste');
  const usuario = userEvent.setup();
  const resultado = render(
    <ContextoUsuarioFluig.Provider value={usuarioMock()}>
      <MemoryRouter initialEntries={[caminho]} future={FUTURO_ROUTER}>
        <RotasApp />
        <EspiaoLocal />
      </MemoryRouter>
    </ContextoUsuarioFluig.Provider>,
  );
  /** Troca a rota "por fora" (como editar a URL/usar um link), sem passar pela interface. */
  function navegar(destino: string) {
    act(() => {
      void navegarAtual?.(destino);
    });
  }
  return { ...resultado, usuario, local: () => localAtual, navegar };
}
