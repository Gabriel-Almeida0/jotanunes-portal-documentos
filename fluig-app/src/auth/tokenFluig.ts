/**
 * Leitura do token Fluig (contracts/fluig-identity.md):
 * 1. fragmento `#fluigToken=<jwt>` (removido da URL com history.replaceState);
 * 2. `sessionStorage['jn.fluigToken']`;
 * 3. só em desenvolvimento: `VITE_FLUIG_DEV_TOKEN` (ou um token fictício quando `VITE_USE_MOCKS=true`).
 */
export const CHAVE_TOKEN = 'jn.fluigToken';

const PADRAO_FRAGMENTO = /(?:^#|[#&?])fluigToken=([^&#]+)/;

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

/** Extrai o token do fragmento e limpa a URL (o token não fica no histórico nem é compartilhado). */
export function lerTokenDoFragmento(): string | null {
  const { hash, pathname, search } = window.location;
  const achado = PADRAO_FRAGMENTO.exec(hash);
  if (!achado) return null;
  let token: string;
  try {
    token = decodeURIComponent(achado[1]);
  } catch {
    token = achado[1];
  }
  window.history.replaceState(window.history.state, '', `${pathname}${search}#/`);
  return token || null;
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
