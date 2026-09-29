/** Política de senha (FR-007/FR-103): 8 a 128 caracteres, ao menos uma letra e um número, diferente da atual. */
export const TAMANHO_MINIMO_SENHA = 8;
export const TAMANHO_MAXIMO_SENHA = 128;

export function temLetraENumero(senha: string): boolean {
  return /\p{L}/u.test(senha) && /\d/.test(senha);
}

export function senhaForte(senha: string): boolean {
  return senha.length >= TAMANHO_MINIMO_SENHA && senha.length <= TAMANHO_MAXIMO_SENHA && temLetraENumero(senha);
}

export interface RegraSenha {
  id: string;
  texto: string;
  ok: boolean;
}

/** Regras mostradas ao lado do campo "Nova senha", marcadas conforme a pessoa digita. */
export function regrasSenha(nova: string, atual: string): RegraSenha[] {
  return [
    { id: 'tamanho', texto: 'Pelo menos 8 caracteres', ok: nova.length >= TAMANHO_MINIMO_SENHA },
    { id: 'letra-numero', texto: 'Letras e números', ok: temLetraENumero(nova) },
    { id: 'diferente', texto: 'Diferente da senha atual', ok: nova.length > 0 && nova !== atual },
  ];
}
