/**
 * Calendário de períodos dos mocks — mesma regra do domínio (003, data-model §3 e research R4/R9).
 * Funções puras sobre datas `AAAA-MM-DD` (sem hora), no fuso de Brasília.
 */
import type { Periodicidade } from '../api/tipos';

const FUSO = 'America/Sao_Paulo';
const fmtLocal = new Intl.DateTimeFormat('en-US', {
  timeZone: FUSO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Data (`AAAA-MM-DD`) de um instante no fuso de Brasília. */
export function dataLocal(instante: string | Date): string {
  const partes = fmtLocal.formatToParts(new Date(instante));
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  return `${v('year')}-${v('month')}-${v('day')}`;
}

function decompor(data: string): [number, number, number] {
  const [a, m, d] = data.split('-').map(Number);
  return [a, m, d];
}

function compor(utc: Date): string {
  return utc.toISOString().slice(0, 10);
}

export function somarDias(data: string, dias: number): string {
  const [a, m, d] = decompor(data);
  return compor(new Date(Date.UTC(a, m - 1, d + dias)));
}

export function somarMeses(data: string, meses: number): string {
  const [a, m, d] = decompor(data);
  return compor(new Date(Date.UTC(a, m - 1 + meses, d)));
}

function ddmm(data: string): string {
  const [, m, d] = decompor(data);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** "Março/2026", "Jan–Mar/2026", "2026", "Fev/2026–Jan/2027", "01/03 a 30/03/2026". */
export function rotuloPeriodo(p: Periodicidade, inicio: string, fim: string): string {
  const [a1, m1] = decompor(inicio);
  const [a2, m2] = decompor(fim);
  if (p.unidade === 'MESES') {
    const n = p.intervalo ?? 1;
    if (n === 1) return `${MESES[m1 - 1]}/${a1}`;
    if (n === 12 && m1 === 1) return String(a1);
    if (a1 === a2) return `${MESES_CURTOS[m1 - 1]}–${MESES_CURTOS[m2 - 1]}/${a1}`;
    return `${MESES_CURTOS[m1 - 1]}/${a1}–${MESES_CURTOS[m2 - 1]}/${a2}`;
  }
  if (inicio === fim) return `${ddmm(inicio)}/${a1}`;
  if (a1 === a2) return `${ddmm(inicio)} a ${ddmm(fim)}/${a1}`;
  return `${ddmm(inicio)}/${a1} a ${ddmm(fim)}/${a2}`;
}

export interface PeriodoCalculado {
  inicio: string;
  fim: string;
  /** fim + prazoDias: último dia para enviar sem atraso. */
  prazo: string;
  rotulo: string;
}

/**
 * Períodos exigidos, do primeiro (que contém `inicioCobranca`) até o que contém `hoje`, em ordem
 * cronológica. MESES ancora no dia 1 do mês de início; DIAS, no próprio dia. Tipo único → [].
 */
export function gerarPeriodos(p: Periodicidade, inicioCobranca: string, hoje: string): PeriodoCalculado[] {
  if (p.unidade === 'UNICA' || inicioCobranca > hoje) return [];
  const n = Math.max(1, p.intervalo ?? 1);
  const prazoDias = p.prazoDias ?? 0;
  const ancora = p.unidade === 'MESES' ? `${inicioCobranca.slice(0, 8)}01` : inicioCobranca;
  const lista: PeriodoCalculado[] = [];
  for (let k = 0; ; k += 1) {
    const inicio = p.unidade === 'MESES' ? somarMeses(ancora, k * n) : somarDias(ancora, k * n);
    if (inicio > hoje) break;
    const fim =
      p.unidade === 'MESES' ? somarDias(somarMeses(ancora, (k + 1) * n), -1) : somarDias(inicio, n - 1);
    lista.push({ inicio, fim, prazo: somarDias(fim, prazoDias), rotulo: rotuloPeriodo(p, inicio, fim) });
  }
  return lista;
}
