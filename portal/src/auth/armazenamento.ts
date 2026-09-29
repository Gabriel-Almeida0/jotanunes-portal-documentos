import type { SessaoPortal } from '../api/tipos';

/** Chave do token do portal no sessionStorage (research R2). */
export const CHAVE_TOKEN = 'jn.portalToken';
/** Dados não sensíveis da sessão (expiração e empresa), para restaurar ao recarregar a página. */
export const CHAVE_SESSAO = 'jn.portalSessao';

export function lerSessaoGuardada(): SessaoPortal | null {
  try {
    const accessToken = sessionStorage.getItem(CHAVE_TOKEN);
    const bruto = sessionStorage.getItem(CHAVE_SESSAO);
    if (!accessToken || !bruto) return null;
    const { expiraEm, empresa } = JSON.parse(bruto) as Omit<SessaoPortal, 'accessToken'>;
    if (!expiraEm || !empresa || new Date(expiraEm).getTime() <= Date.now()) return null;
    return { accessToken, expiraEm, empresa };
  } catch {
    return null;
  }
}

export function guardarSessao(sessao: SessaoPortal | null): void {
  try {
    if (!sessao) {
      sessionStorage.removeItem(CHAVE_TOKEN);
      sessionStorage.removeItem(CHAVE_SESSAO);
      return;
    }
    sessionStorage.setItem(CHAVE_TOKEN, sessao.accessToken);
    sessionStorage.setItem(
      CHAVE_SESSAO,
      JSON.stringify({ expiraEm: sessao.expiraEm, empresa: sessao.empresa }),
    );
  } catch {
    // sessionStorage indisponível (modo privado restrito): a sessão fica só em memória.
  }
}
