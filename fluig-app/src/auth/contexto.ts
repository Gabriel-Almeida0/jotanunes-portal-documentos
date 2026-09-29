import { createContext, useContext } from 'react';
import type { OrigemSessao, SessaoJotanunes, UsuarioFluig } from '../api/tipos';

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

/**
 * Sessão da área Jotanunes (research R17): de onde veio (`FLUIG` ou `LOGIN_LOCAL`) e as ações do
 * login próprio. Fora do `AuthFluigProvider` (ex.: testes de tela) as ações não fazem nada.
 */
export interface Sessao {
  /** Origem da sessão atual (`null` antes de haver sessão). */
  origem: OrigemSessao | null;
  /** Guarda o token do login próprio (memória + `sessionStorage`) e abre o app (ou a troca de senha). */
  entrar: (sessao: SessaoJotanunes) => void;
  /** Troca o token pelo novo (depois da troca de senha); `recado` aparece no painel. */
  atualizarToken: (sessao: SessaoJotanunes, recado?: string) => void;
  /**
   * Encerra a sessão de login próprio: chama `POST /api/fluig/auth/sair` (falha é ignorada), apaga o
   * token e volta à tela de login, com `aviso` quando informado.
   */
  sair: (aviso?: string) => Promise<void>;
  /** Mensagem deixada para o painel (ex.: "Senha alterada."). Lida uma única vez. */
  consumirRecado: () => string | null;
}

const SESSAO_VAZIA: Sessao = {
  origem: null,
  entrar: () => undefined,
  atualizarToken: () => undefined,
  sair: async () => undefined,
  consumirRecado: () => null,
};

export const ContextoSessao = createContext<Sessao>(SESSAO_VAZIA);

export function useSessao(): Sessao {
  return useContext(ContextoSessao);
}
