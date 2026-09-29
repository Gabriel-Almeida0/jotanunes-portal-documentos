import type { ReactNode } from 'react';
import { useEhAdmin } from '../auth/contexto';

/**
 * Renderiza os filhos só para o administrador. Para o usuário comum a ação some (não fica
 * desabilitada — research R16); `senao` permite mostrar a versão somente leitura no lugar.
 */
export function SomenteAdmin({ children, senao = null }: { children: ReactNode; senao?: ReactNode }) {
  return <>{useEhAdmin() ? children : senao}</>;
}
