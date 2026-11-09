import type { Periodicidade, PeriodoRef, ResumoPeriodos } from '../api/tipos';

/**
 * Periodicidade do tipo de documento (003). A API guarda só `unidade` + `intervalo` (research R2);
 * a "lista pronta" (Mensal, Trimestral…) é só apresentação, feita aqui.
 */
export type OpcaoPeriodicidade =
  | 'UNICA'
  | 'MENSAL'
  | 'BIMESTRAL'
  | 'TRIMESTRAL'
  | 'SEMESTRAL'
  | 'ANUAL'
  | 'N_MESES'
  | 'N_DIAS';

export const OPCOES_PERIODICIDADE: { valor: OpcaoPeriodicidade; rotulo: string }[] = [
  { valor: 'UNICA', rotulo: 'Único (um envio vale para sempre)' },
  { valor: 'MENSAL', rotulo: 'Mensal' },
  { valor: 'BIMESTRAL', rotulo: 'Bimestral' },
  { valor: 'TRIMESTRAL', rotulo: 'Trimestral' },
  { valor: 'SEMESTRAL', rotulo: 'Semestral' },
  { valor: 'ANUAL', rotulo: 'Anual' },
  { valor: 'N_MESES', rotulo: 'A cada N meses' },
  { valor: 'N_DIAS', rotulo: 'A cada N dias' },
];

/** Meses de cada opção pronta. */
const MESES_DA_OPCAO: Partial<Record<OpcaoPeriodicidade, number>> = {
  MENSAL: 1,
  BIMESTRAL: 2,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

const NOME_POR_MESES: Record<number, string> = {
  1: 'Mensal',
  2: 'Bimestral',
  3: 'Trimestral',
  6: 'Semestral',
  12: 'Anual',
};

export const LIMITES = {
  meses: { min: 1, max: 24 },
  dias: { min: 1, max: 365 },
  prazo: { min: 0, max: 90, padrao: 15 },
} as const;

export function ehPeriodico(p: Periodicidade | null | undefined): boolean {
  return Boolean(p && p.unidade !== 'UNICA');
}

/** Opção do select para uma periodicidade vinda da API (ex.: MESES/3 → Trimestral). */
export function opcaoDe(p: Periodicidade | null | undefined): OpcaoPeriodicidade {
  if (!p || p.unidade === 'UNICA') return 'UNICA';
  if (p.unidade === 'DIAS') return 'N_DIAS';
  const pronta = (Object.keys(MESES_DA_OPCAO) as OpcaoPeriodicidade[]).find((o) => MESES_DA_OPCAO[o] === p.intervalo);
  return pronta ?? 'N_MESES';
}

/** Periodicidade enviada à API (sem `descricao`, que é só de resposta). */
export function paraPeriodicidade(opcao: OpcaoPeriodicidade, n: number, prazoDias: number): Periodicidade {
  if (opcao === 'UNICA') return { unidade: 'UNICA', intervalo: null, prazoDias: null };
  if (opcao === 'N_DIAS') return { unidade: 'DIAS', intervalo: n, prazoDias };
  return { unidade: 'MESES', intervalo: MESES_DA_OPCAO[opcao] ?? n, prazoDias };
}

/** Só os campos de entrada (o PUT de tipo reenvia a periodicidade atual sem `descricao`). */
export function periodicidadeDeEntrada(p: Periodicidade | null | undefined): Periodicidade {
  if (!p || p.unidade === 'UNICA') return { unidade: 'UNICA', intervalo: null, prazoDias: null };
  return { unidade: p.unidade, intervalo: p.intervalo ?? null, prazoDias: p.prazoDias ?? null };
}

/** "Mensal", "Trimestral", "A cada 4 meses", "A cada 30 dias", "Único". */
export function nomePeriodicidade(p: Periodicidade): string {
  const n = p.intervalo ?? 1;
  if (p.unidade === 'UNICA') return 'Único';
  if (p.unidade === 'MESES') return NOME_POR_MESES[n] ?? `A cada ${n} meses`;
  return n === 1 ? 'A cada 1 dia' : `A cada ${n} dias`;
}

/** "até o dia 15 do mês seguinte", "até 10 dias após o fim do período", "até o último dia do período". */
export function textoPrazo(p: Periodicidade): string {
  const prazo = p.prazoDias ?? 0;
  if (prazo === 0) return 'até o último dia do período';
  if (p.unidade === 'MESES' && p.intervalo === 1 && prazo <= 28) return `até o dia ${prazo} do mês seguinte`;
  return prazo === 1 ? 'até 1 dia após o fim do período' : `até ${prazo} dias após o fim do período`;
}

/** Texto curto da regra, igual ao `descricao` da API: "Mensal · até o dia 15 do mês seguinte". */
export function descreverPeriodicidade(p: Periodicidade): string {
  if (p.unidade === 'UNICA') return 'Único';
  return `${nomePeriodicidade(p)} · ${textoPrazo(p)}`;
}

/** Texto a mostrar: o `descricao` da API ou, na falta, o montado aqui. */
export function textoPeriodicidade(p: Periodicidade | null | undefined): string {
  if (!p) return 'Único';
  return p.descricao || descreverPeriodicidade(p);
}

/** Prévia do formulário (FR-332): "Mensal · um arquivo por mês, até o dia 15 do mês seguinte." */
export function previaPeriodicidade(p: Periodicidade): string {
  if (p.unidade === 'UNICA') return 'Único · a empresa envia um arquivo, que vale enquanto o tipo for exigido.';
  const n = p.intervalo ?? 1;
  const frequencia =
    p.unidade === 'MESES'
      ? n === 1
        ? 'um arquivo por mês'
        : `um arquivo a cada ${n} meses`
      : n === 1
        ? 'um arquivo por dia'
        : `um arquivo a cada ${n} dias`;
  const contagem =
    p.unidade === 'MESES'
      ? 'Os períodos seguem os meses do calendário, a partir do mês em que a empresa passa a dever o documento.'
      : 'Os períodos contam a partir do dia em que a empresa passa a dever o documento.';
  return `${nomePeriodicidade(p)} · ${frequencia}, ${textoPrazo(p)}. ${contagem}`;
}

const contar = (n: number, singular: string, pluralForma: string) => `${n} ${n === 1 ? singular : pluralForma}`;

/**
 * "2 atrasados · 1 em análise · 1 aprovado" (só as situações presentes). `atrasados` é subconjunto de
 * pendentes + rejeitados; com atraso, o resto deles aparece como "a enviar no prazo".
 */
export function textoResumoPeriodos(r: ResumoPeriodos): string {
  const noPrazo = Math.max(0, r.pendentes + r.rejeitados - r.atrasados);
  const partes = r.atrasados
    ? [
        contar(r.atrasados, 'atrasado', 'atrasados'),
        noPrazo ? `${noPrazo} a enviar no prazo` : null,
      ]
    : [
        r.rejeitados ? contar(r.rejeitados, 'rejeitado', 'rejeitados') : null,
        r.pendentes ? contar(r.pendentes, 'pendente', 'pendentes') : null,
      ];
  partes.push(
    r.emAnalise ? `${r.emAnalise} em análise` : null,
    r.aprovados ? contar(r.aprovados, 'aprovado', 'aprovados') : null,
  );
  const texto = partes.filter(Boolean).join(' · ');
  return texto || 'Nenhum período exigido ainda';
}

/**
 * Prazo de um período (fim + prazoDias do tipo), em `AAAA-MM-DD`. O `Envio.periodo` do contrato não
 * traz o prazo; ele é derivado da periodicidade atual do tipo (o prazo vale para todos os períodos).
 */
export function prazoDoPeriodo(periodo: PeriodoRef, p: Periodicidade | null | undefined): string | null {
  if (!p || p.unidade === 'UNICA' || p.prazoDias === null || p.prazoDias === undefined) return null;
  const [a, m, d] = periodo.fim.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + p.prazoDias)).toISOString().slice(0, 10);
}

/** `AAAA-MM-DD` → `dd/mm/aaaa` (datas sem hora, sem conversão de fuso). */
export function formatarDiaIso(data: string | null | undefined): string {
  if (!data) return '—';
  const [a, m, d] = data.split('-');
  return `${d}/${m}/${a}`;
}
