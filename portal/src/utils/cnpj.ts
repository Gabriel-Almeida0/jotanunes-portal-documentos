/**
 * CNPJ numérico e alfanumérico (Receita Federal, vigente desde jul/2026) — research R9.
 * Raiz + ordem: 12 caracteres [0-9A-Z]; DV: 2 dígitos. Valor de cada caractere = código ASCII − 48.
 */

const PESOS_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Remove `.`, `/`, `-` e espaços e passa para maiúsculas. */
export function normalizarCnpj(valor: string): string {
  return valor.replace(/[.\-/\s]/g, '').toUpperCase();
}

function digitoVerificador(base: string, pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < pesos.length; i++) {
    soma += (base.charCodeAt(i) - 48) * pesos[i];
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(valor: string): boolean {
  const cnpj = normalizarCnpj(valor);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return false;
  if (/^(.)\1{13}$/.test(cnpj)) return false;
  const dv1 = digitoVerificador(cnpj.slice(0, 12), PESOS_DV1);
  const dv2 = digitoVerificador(cnpj.slice(0, 12) + dv1, PESOS_DV2);
  return cnpj.endsWith(`${dv1}${dv2}`);
}

/** Mantém só os caracteres aceitos em cada posição (letras só na raiz/ordem), até 14. */
function caracteresAceitos(valor: string): string {
  let resultado = '';
  for (const c of valor.toUpperCase()) {
    if (resultado.length >= 14) break;
    const aceito = resultado.length < 12 ? /[0-9A-Z]/.test(c) : /[0-9]/.test(c);
    if (aceito) resultado += c;
  }
  return resultado;
}

/** Máscara progressiva `XX.XXX.XXX/XXXX-XX` para usar enquanto a pessoa digita. */
export function mascararCnpj(valor: string): string {
  const c = caracteresAceitos(valor);
  let saida = c.slice(0, 2);
  if (c.length > 2) saida += `.${c.slice(2, 5)}`;
  if (c.length > 5) saida += `.${c.slice(5, 8)}`;
  if (c.length > 8) saida += `/${c.slice(8, 12)}`;
  if (c.length > 12) saida += `-${c.slice(12, 14)}`;
  return saida;
}

/** Formata um CNPJ de 14 caracteres (como vem da API) para exibição. */
export function formatarCnpj(cnpj: string): string {
  return mascararCnpj(normalizarCnpj(cnpj));
}
