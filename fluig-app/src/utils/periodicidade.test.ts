import {
  descreverPeriodicidade,
  opcaoDe,
  paraPeriodicidade,
  prazoDoPeriodo,
  previaPeriodicidade,
  textoResumoPeriodos,
} from './periodicidade';

describe('Periodicidade (textos e lista pronta)', () => {
  it('converte a lista pronta em unidade + intervalo e volta', () => {
    expect(paraPeriodicidade('MENSAL', 1, 15)).toEqual({ unidade: 'MESES', intervalo: 1, prazoDias: 15 });
    expect(paraPeriodicidade('ANUAL', 1, 30)).toEqual({ unidade: 'MESES', intervalo: 12, prazoDias: 30 });
    expect(paraPeriodicidade('N_DIAS', 30, 5)).toEqual({ unidade: 'DIAS', intervalo: 30, prazoDias: 5 });
    expect(paraPeriodicidade('UNICA', 1, 15)).toEqual({ unidade: 'UNICA', intervalo: null, prazoDias: null });
    expect(opcaoDe({ unidade: 'MESES', intervalo: 3 })).toBe('TRIMESTRAL');
    expect(opcaoDe({ unidade: 'MESES', intervalo: 4 })).toBe('N_MESES');
    expect(opcaoDe({ unidade: 'DIAS', intervalo: 7 })).toBe('N_DIAS');
    expect(opcaoDe(undefined)).toBe('UNICA');
  });

  it('descreve a regra como a API', () => {
    expect(descreverPeriodicidade({ unidade: 'MESES', intervalo: 1, prazoDias: 15 })).toBe(
      'Mensal · até o dia 15 do mês seguinte',
    );
    expect(descreverPeriodicidade({ unidade: 'MESES', intervalo: 4, prazoDias: 10 })).toBe(
      'A cada 4 meses · até 10 dias após o fim do período',
    );
    expect(descreverPeriodicidade({ unidade: 'DIAS', intervalo: 30, prazoDias: 0 })).toBe(
      'A cada 30 dias · até o último dia do período',
    );
    expect(descreverPeriodicidade({ unidade: 'UNICA' })).toBe('Único');
  });

  it('prévia do formulário (FR-332)', () => {
    expect(previaPeriodicidade({ unidade: 'MESES', intervalo: 1, prazoDias: 15 })).toMatch(
      /^Mensal · um arquivo por mês, até o dia 15 do mês seguinte\./,
    );
  });

  it('resumo dos períodos: atrasados são parte de pendentes + rejeitados', () => {
    expect(
      textoResumoPeriodos({ atrasados: 2, pendentes: 2, rejeitados: 1, emAnalise: 1, aprovados: 0 }),
    ).toBe('2 atrasados · 1 a enviar no prazo · 1 em análise');
    expect(textoResumoPeriodos({ atrasados: 0, pendentes: 1, rejeitados: 0, emAnalise: 0, aprovados: 3 })).toBe(
      '1 pendente · 3 aprovados',
    );
  });

  it('prazo do período = fim + prazo do tipo', () => {
    const periodo = { inicio: '2026-08-01', fim: '2026-08-31', rotulo: 'Agosto/2026' };
    expect(prazoDoPeriodo(periodo, { unidade: 'MESES', intervalo: 1, prazoDias: 15 })).toBe('2026-09-15');
    expect(prazoDoPeriodo(periodo, { unidade: 'UNICA' })).toBeNull();
  });
});
