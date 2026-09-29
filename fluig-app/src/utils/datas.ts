const FUSO = 'America/Sao_Paulo';

const fmtData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const fmtHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function paraData(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `27/09/2026` no fuso de São Paulo. */
export function formatarData(valor: string | Date | null | undefined): string {
  const d = paraData(valor);
  return d ? fmtData.format(d) : '—';
}

/** `27/09/2026 às 23:30` no fuso de São Paulo. */
export function formatarDataHora(valor: string | Date | null | undefined): string {
  const d = paraData(valor);
  return d ? `${fmtData.format(d)} às ${fmtHora.format(d)}` : '—';
}

/** "hoje", "há 1 dia", "há 5 dias" — para mostrar há quanto tempo um envio espera. */
export function tempoDecorrido(valor: string | Date | null | undefined, agora: Date = new Date()): string {
  const d = paraData(valor);
  if (!d) return '—';
  const dias = Math.floor((agora.getTime() - d.getTime()) / 86_400_000);
  if (dias <= 0) return 'hoje';
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}
