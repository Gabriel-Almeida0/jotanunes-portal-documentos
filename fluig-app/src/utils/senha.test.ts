import { regrasSenha, senhaForte } from './senha';

describe('política de senha', () => {
  it('exige 8 a 128 caracteres com letra e número', () => {
    expect(senhaForte('Nova1234')).toBe(true);
    expect(senhaForte('abc123')).toBe(false);
    expect(senhaForte('abcdefgh')).toBe(false);
    expect(senhaForte('12345678')).toBe(false);
    expect(senhaForte(`a1${'x'.repeat(127)}`)).toBe(false);
  });

  it('marca as regras conforme a digitação', () => {
    expect(regrasSenha('Temp1234', 'Temp1234').map((r) => r.ok)).toEqual([true, true, false]);
    expect(regrasSenha('Nova1234', 'Temp1234').every((r) => r.ok)).toBe(true);
  });
});
