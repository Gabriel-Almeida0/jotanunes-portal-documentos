import type { Periodicidade } from '../api/tipos';
import { dataLocal, gerarPeriodos, rotuloPeriodo } from './periodos';

const meses = (intervalo: number, prazoDias = 15): Periodicidade => ({ unidade: 'MESES', intervalo, prazoDias });
const dias = (intervalo: number, prazoDias = 15): Periodicidade => ({ unidade: 'DIAS', intervalo, prazoDias });
const rotulos = (p: Periodicidade, inicio: string, hoje: string) => gerarPeriodos(p, inicio, hoje).map((x) => x.rotulo);

describe('Calendário de períodos do mock (data-model §3)', () => {
  it('mensal desde o meio do mês começa no dia 1 daquele mês e vai até o mês em curso', () => {
    const lista = gerarPeriodos(meses(1), '2026-07-26', '2026-10-26');
    expect(lista.map((p) => p.rotulo)).toEqual(['Julho/2026', 'Agosto/2026', 'Setembro/2026', 'Outubro/2026']);
    expect(lista[0]).toEqual({ inicio: '2026-07-01', fim: '2026-07-31', prazo: '2026-08-15', rotulo: 'Julho/2026' });
  });

  it('trimestral começando em fevereiro', () => {
    expect(rotulos(meses(3), '2026-02-10', '2026-08-01')).toEqual(['Fev–Abr/2026', 'Mai–Jul/2026', 'Ago–Out/2026']);
  });

  it('anual: "2026" quando começa em janeiro; datas cruzando o ano nos outros casos', () => {
    expect(rotulos(meses(12), '2026-01-05', '2026-03-01')).toEqual(['2026']);
    expect(rotulos(meses(12), '2026-02-05', '2027-03-01')).toEqual(['Fev/2026–Jan/2027', 'Fev/2027–Jan/2028']);
  });

  it('a cada 30 dias conta a partir do próprio dia, com rótulo por datas', () => {
    const lista = gerarPeriodos(dias(30, 5), '2026-03-01', '2026-04-15');
    expect(lista.map((p) => p.rotulo)).toEqual(['01/03 a 30/03/2026', '31/03 a 29/04/2026']);
    expect(lista[0].prazo).toBe('2026-04-04');
    expect(rotuloPeriodo(dias(30), '2026-12-20', '2027-01-18')).toBe('20/12/2026 a 18/01/2027');
  });

  it('fevereiro de ano bissexto termina no dia 29', () => {
    const [fev] = gerarPeriodos(meses(1, 0), '2028-02-10', '2028-02-29');
    expect(fev).toMatchObject({ inicio: '2028-02-01', fim: '2028-02-29', prazo: '2028-02-29', rotulo: 'Fevereiro/2028' });
  });

  it('hoje = último dia do período não abre o próximo; nunca cobra antes do início', () => {
    expect(rotulos(meses(1), '2026-09-15', '2026-09-30')).toEqual(['Setembro/2026']);
    expect(gerarPeriodos(meses(1), '2026-11-01', '2026-10-26')).toEqual([]);
    expect(gerarPeriodos({ unidade: 'UNICA', intervalo: null, prazoDias: null }, '2026-01-01', '2026-10-26')).toEqual([]);
  });

  it('usa a data de Brasília: 23h de 31/03 em UTC−3 ainda é março', () => {
    expect(dataLocal('2026-04-01T02:00:00Z')).toBe('2026-03-31');
    expect(dataLocal('2026-04-01T03:00:00Z')).toBe('2026-04-01');
  });
});
