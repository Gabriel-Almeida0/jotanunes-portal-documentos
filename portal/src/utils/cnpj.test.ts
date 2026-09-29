import { describe, expect, it } from 'vitest';
import { cnpjValido, formatarCnpj, mascararCnpj, normalizarCnpj } from './cnpj';

// Os três CNPJs de exemplo da spec/quickstart.
const NUMERICO_1 = '12.345.678/0001-95';
const NUMERICO_2 = '11.222.333/0001-81';
const ALFANUMERICO = '12.ABC.345/01DE-35';

describe('normalizarCnpj', () => {
  it('remove máscara e espaços e passa para maiúsculas', () => {
    expect(normalizarCnpj(NUMERICO_1)).toBe('12345678000195');
    expect(normalizarCnpj(' 12.abc.345/01de-35 ')).toBe('12ABC34501DE35');
  });
});

describe('cnpjValido', () => {
  it.each([NUMERICO_1, NUMERICO_2, ALFANUMERICO, '12345678000195', '12abc34501de35'])(
    'aceita %s',
    (valor) => {
      expect(cnpjValido(valor)).toBe(true);
    },
  );

  it.each([
    ['DV numérico errado', '12.345.678/0001-96'],
    ['DV alfanumérico errado', '12.ABC.345/01DE-36'],
    ['todos iguais', '11.111.111/1111-11'],
    ['curto', '1234567800019'],
    ['letra no DV', '12.ABC.345/01DE-3A'],
    ['vazio', ''],
  ])('recusa %s', (_caso, valor) => {
    expect(cnpjValido(valor)).toBe(false);
  });
});

describe('mascararCnpj (máscara progressiva)', () => {
  it('formata enquanto digita', () => {
    expect(mascararCnpj('12')).toBe('12');
    expect(mascararCnpj('123')).toBe('12.3');
    expect(mascararCnpj('123456')).toBe('12.345.6');
    expect(mascararCnpj('123456780')).toBe('12.345.678/0');
    expect(mascararCnpj('1234567800019')).toBe('12.345.678/0001-9');
    expect(mascararCnpj('12345678000195')).toBe(NUMERICO_1);
  });

  it('aceita letras na raiz e na ordem (formato alfanumérico)', () => {
    expect(mascararCnpj('12abc34501de35')).toBe(ALFANUMERICO);
  });

  it('ignora caracteres inválidos, letras no DV e o que passar de 14', () => {
    expect(mascararCnpj('12.345.678/0001-95999')).toBe(NUMERICO_1);
    expect(mascararCnpj('12ABC34501DEX5')).toBe('12.ABC.345/01DE-5');
    expect(mascararCnpj('!@#')).toBe('');
  });
});

describe('formatarCnpj', () => {
  it('aplica a máscara em CNPJ de 14 caracteres vindo da API', () => {
    expect(formatarCnpj('12345678000195')).toBe(NUMERICO_1);
    expect(formatarCnpj('12ABC34501DE35')).toBe(ALFANUMERICO);
  });
});
