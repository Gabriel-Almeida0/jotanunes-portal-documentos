import { createContext, useContext } from 'react';
import type { UsuarioFluig } from '../api/tipos';

export const ContextoUsuarioFluig = createContext<UsuarioFluig | null>(null);

export function useUsuarioFluig(): UsuarioFluig {
  const usuario = useContext(ContextoUsuarioFluig);
  if (!usuario) throw new Error('useUsuarioFluig precisa estar dentro de <AuthFluigProvider>.');
  return usuario;
}
