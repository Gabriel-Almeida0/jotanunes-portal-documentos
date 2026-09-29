import { describe, expect, it } from 'vitest';
import { formatarDataHora, formatarHora, formatarTamanho } from './datas';

describe('datas (America/Sao_Paulo)', () => {
  it('formata data e hora no fuso de Brasília', () => {
    expect(formatarDataHora('2026-09-28T17:32:00Z')).toBe('28/09/2026 às 14:32');
  });

  it('formata só a hora', () => {
    expect(formatarHora('2026-09-28T17:47:00Z')).toBe('14:47');
  });
});

describe('formatarTamanho', () => {
  it('usa KB e MB com vírgula', () => {
    expect(formatarTamanho(512)).toBe('512 bytes');
    expect(formatarTamanho(2048)).toBe('2 KB');
    expect(formatarTamanho(1_258_291)).toBe('1,2 MB');
  });
});
