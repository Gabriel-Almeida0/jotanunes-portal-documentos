/** Regras da nova senha (FR-007): ≥ 8 caracteres, letra, número e diferente da atual. */
export function regrasSenha(nova: string, atual: string) {
  return [
    { id: 'tamanho', texto: 'Pelo menos 8 caracteres', ok: nova.length >= 8 },
    { id: 'letra', texto: 'Pelo menos uma letra', ok: /[A-Za-z]/.test(nova) },
    { id: 'numero', texto: 'Pelo menos um número', ok: /\d/.test(nova) },
    { id: 'diferente', texto: 'Diferente da senha atual', ok: nova.length > 0 && nova !== atual },
  ];
}

/** Senha forte segundo o contrato: 8 a 128 caracteres, com letra e número. */
export function senhaForte(senha: string): boolean {
  return senha.length >= 8 && senha.length <= 128 && /[A-Za-z]/.test(senha) && /\d/.test(senha);
}
