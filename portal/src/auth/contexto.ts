import { createContext, useContext } from 'react';
import type { EmpresaPortal, SessaoPortal } from '../api/tipos';

export interface ValorSessao {
  sessao: SessaoPortal | null;
  empresa: EmpresaPortal | null;
  trocaSenhaObrigatoria: boolean;
  /** Aviso a mostrar na tela de acesso (ex.: sessão expirada). */
  aviso: string | null;
  entrar: (sessao: SessaoPortal) => void;
  atualizar: (sessao: SessaoPortal) => void;
  sair: (aviso?: string) => void;
  limparAviso: () => void;
  /** Recado de sucesso para a próxima tela (ex.: "Senha criada."). Lido uma vez. */
  deixarRecado: (texto: string) => void;
  pegarRecado: () => string | null;
}

export const ContextoSessao = createContext<ValorSessao | null>(null);

export function useSessao(): ValorSessao {
  const valor = useContext(ContextoSessao);
  if (!valor) throw new Error('useSessao precisa estar dentro de <SessaoProvider>.');
  return valor;
}
