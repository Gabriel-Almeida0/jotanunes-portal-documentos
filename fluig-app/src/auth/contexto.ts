import { createContext, useContext } from 'react';
import type { UsuarioFluig } from '../api/tipos';

export const ContextoUsuarioFluig = createContext<UsuarioFluig | null>(null);

export function useUsuarioFluig(): UsuarioFluig {
  const usuario = useContext(ContextoUsuarioFluig);
  if (!usuario) throw new Error('useUsuarioFluig precisa estar dentro de <AuthFluigProvider>.');
  return usuario;
}

/**
 * `true` quando o usuário é administrador (`admin` de `GET /api/fluig/me`, claim `roles` do token).
 * Serve só para esconder ações: quem decide é a API (403 `SEM_PERMISSAO`).
 */
export function useEhAdmin(): boolean {
  return useUsuarioFluig().admin === true;
}
