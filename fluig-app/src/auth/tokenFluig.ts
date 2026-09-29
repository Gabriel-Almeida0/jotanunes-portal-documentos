/**
 * Leitura do token Fluig (contracts/fluig-identity.md):
 * 1. fragmento `#fluigToken=<jwt>` (removido da URL com history.replaceState);
 * 2. `sessionStorage['jn.fluigToken']`;
 * 3. só em desenvolvimento: `VITE_FLUIG_DEV_TOKEN` (ou um token fictício quando `VITE_USE_MOCKS=true`).
 *
 * Depois da carga, o Fluig pode entregar um token novo (ou renovar o atual) trocando só o fragmento
 * no mesmo iframe; o AuthFluigProvider escuta `hashchange`/`popstate` e usa `lerTokenDoFragmento`.
 */
export const CHAVE_TOKEN = 'jn.fluigToken';

const PARAMETRO_TOKEN = 'fluigToken';

function lerSessao(): string | null {
  try {
    return window.sessionStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
}

export function guardarToken(token: string): void {
  try {
    window.sessionStorage.setItem(CHAVE_TOKEN, token);
  } catch {
    // sessionStorage indisponível (ex.: iframe com armazenamento bloqueado): fica só em memória.
  }
}

export function descartarToken(): void {
  try {
    window.sessionStorage.removeItem(CHAVE_TOKEN);
  } catch {
    // ignora
  }
}

interface FragmentoAnalisado {
  /** `null` quando o fragmento não traz `fluigToken`. `''` quando traz, mas vazio. */
  token: string | null;
  /** Rota do HashRouter contida no fragmento (ex.: `/obras?x=1`), sem o token; `null` se não houver. */
  rota: string | null;
}

/**
 * Aceita `#fluigToken=<jwt>` (formato do contrato) e também `#/rota?fluigToken=<jwt>` (rota + token).
 */
function analisarFragmento(hash: string): FragmentoAnalisado {
  const conteudo = hash.replace(/^#/, '');
  if (conteudo.startsWith('/')) {
    const i = conteudo.indexOf('?');
    if (i < 0) return { token: null, rota: conteudo };
    const caminho = conteudo.slice(0, i);
    const params = new URLSearchParams(conteudo.slice(i + 1));
    const token = params.get(PARAMETRO_TOKEN);
    params.delete(PARAMETRO_TOKEN);
    const consulta = params.toString();
    return { token, rota: `${caminho}${consulta ? `?${consulta}` : ''}` };
  }
  const params = new URLSearchParams(conteudo);
  return { token: params.get(PARAMETRO_TOKEN), rota: null };
}

/** Rota atual do HashRouter (fragmento sem `#`), ou `null` se o fragmento não for uma rota. */
export function rotaDoFragmento(): string | null {
  const { token, rota } = analisarFragmento(window.location.hash);
  return token === null ? rota : null;
}

/**
 * Extrai o token do fragmento e limpa a URL com `history.replaceState` — a entrada do histórico que
 * tinha o token é substituída, então ele não fica na URL, no histórico nem é compartilhado.
 * A URL passa a apontar para a rota que veio junto com o token; sem rota, para `rotaReserva`
 * (a rota em que o usuário estava, na renovação do token) ou para o início.
 */
export function lerTokenDoFragmento(rotaReserva?: string | null): string | null {
  const { hash, pathname, search } = window.location;
  const { token, rota } = analisarFragmento(hash);
  if (token === null) return null;
  const destino = rota || rotaReserva || '/';
  window.history.replaceState(window.history.state, '', `${pathname}${search}#${destino}`);
  return token.trim() || null;
}

function tokenDeDesenvolvimento(): string | null {
  if (!import.meta.env.DEV) return null;
  const dev = (import.meta.env.VITE_FLUIG_DEV_TOKEN as string | undefined)?.trim();
  if (dev) return dev;
  if (import.meta.env.VITE_USE_MOCKS === 'true') return 'token-dev-mocks';
  return null;
}

export function obterTokenInicial(): string | null {
  const doFragmento = lerTokenDoFragmento();
  if (doFragmento) {
    guardarToken(doFragmento);
    return doFragmento;
  }
  return lerSessao() ?? tokenDeDesenvolvimento();
}
