/**
 * CNPJ numérico e alfanumérico (research R9):
 * normaliza (sem `.`, `/`, `-`, espaços; maiúsculas), exige `^[0-9A-Z]{12}[0-9]{2}$`, recusa 14
 * caracteres iguais e confere os DVs pelo módulo 11 (valor do caractere = código ASCII − 48).
 */

const PESOS_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const FORMATO = /^[0-9A-Z]{12}[0-9]{2}$/;

export function normalizarCnpj(valor: string): string {
  return valor.replace(/[.\-/\s]/g, '').toUpperCase();
}

function digito(base: string, pesos: number[]): number {
  let soma = 0;
  for (let i = 0; i < pesos.length; i++) {
    soma += (base.charCodeAt(i) - 48) * pesos[i];
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cnpjValido(valor: string): boolean {
  const cnpj = normalizarCnpj(valor);
  if (!FORMATO.test(cnpj)) return false;
  if (/^(.)\1{13}$/.test(cnpj)) return false;
  const dv1 = digito(cnpj.slice(0, 12), PESOS_DV1);
  if (dv1 !== Number(cnpj[12])) return false;
  const dv2 = digito(cnpj.slice(0, 13), PESOS_DV2);
  return dv2 === Number(cnpj[13]);
}

/** Mensagem de erro para o campo, ou `null` se válido. */
export function validarCnpj(valor: string): string | null {
  if (!valor.trim()) return 'Informe o CNPJ.';
  if (!cnpjValido(valor)) return 'CNPJ inválido. Confira os dígitos.';
  return null;
}

/** `12345678000195` → `12.345.678/0001-95` (devolve o valor original se não tiver 14 caracteres). */
export function formatarCnpj(valor: string | null | undefined): string {
  if (!valor) return '';
  const cnpj = normalizarCnpj(valor);
  if (cnpj.length !== 14) return valor;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

/** Máscara progressiva para o input (aceita letras nas 12 primeiras posições). */
export function mascararCnpjDigitado(valor: string): string {
  const limpo = normalizarCnpj(valor)
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 14);
  let saida = '';
  for (let i = 0; i < limpo.length; i++) {
    if (i === 2 || i === 5) saida += '.';
    else if (i === 8) saida += '/';
    else if (i === 12) saida += '-';
    saida += limpo[i];
  }
  return saida;
}
