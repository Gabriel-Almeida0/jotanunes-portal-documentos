/** Tamanho em bytes legível: `532 KB`, `2,4 MB`. */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

/** Só dígitos → `(79) 3222-1234` / `(79) 99999-1234`. */
export function formatarTelefone(valor: string | null | undefined): string {
  if (!valor) return '';
  const d = valor.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor;
}

/** Plural simples: `plural(1, 'empresa', 'empresas')`. */
export function plural(qtd: number, singular: string, pluralForma: string): string {
  return `${qtd} ${qtd === 1 ? singular : pluralForma}`;
}

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
