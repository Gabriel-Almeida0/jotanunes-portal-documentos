const FUSO = 'America/Sao_Paulo';

const formatoData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const formatoHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** "28/09/2026 às 14:32" no horário de Brasília. */
export function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  return `${formatoData.format(data)} às ${formatoHora.format(data)}`;
}

/** "14:47" no horário de Brasília. */
export function formatarHora(iso: string): string {
  return formatoHora.format(new Date(iso));
}

const formatoNumero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${formatoNumero.format(Math.round(bytes / 1024))} KB`;
  return `${formatoNumero.format(bytes / (1024 * 1024))} MB`;
}

/** "15/11/2026" a partir de uma data sem hora do contrato ("2026-11-15"), sem mudar de fuso. */
export function formatarData(data: string): string {
  const [ano, mes, dia] = data.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

const formatoDataIso = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Hoje no horário de Brasília, como "AAAA-MM-DD" (compara com prazos do contrato). */
export function hojeLocal(): string {
  return formatoDataIso.format(new Date());
}
