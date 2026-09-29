import { formatarData, formatarDataHora } from './datas';

describe('datas', () => {
  it('formata no fuso de America/Sao_Paulo', () => {
    // 2026-09-28T02:30Z = 27/09/2026 23:30 em São Paulo (UTC−3)
    expect(formatarDataHora('2026-09-28T02:30:00Z')).toBe('27/09/2026 às 23:30');
    expect(formatarData('2026-09-28T02:30:00Z')).toBe('27/09/2026');
  });

  it('devolve travessão para valor vazio', () => {
    expect(formatarDataHora(null)).toBe('—');
    expect(formatarData(undefined)).toBe('—');
  });
});
