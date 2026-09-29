import { cnpjValido, formatarCnpj, mascararCnpjDigitado, normalizarCnpj, validarCnpj } from './cnpj';

describe('CNPJ', () => {
  it.each([
    ['12.345.678/0001-95', '12345678000195'],
    ['11.222.333/0001-81', '11222333000181'],
    ['12.ABC.345/01DE-35', '12ABC34501DE35'],
    ['12.abc.345/01de-35', '12ABC34501DE35'],
    [' 11222333000181 ', '11222333000181'],
  ])('normaliza %s para %s e aceita o DV', (entrada, normalizado) => {
    expect(normalizarCnpj(entrada)).toBe(normalizado);
    expect(cnpjValido(entrada)).toBe(true);
    expect(validarCnpj(entrada)).toBeNull();
  });

  it('recusa DV errado (numérico e alfanumérico)', () => {
    expect(cnpjValido('12.345.678/0001-96')).toBe(false);
    expect(cnpjValido('11.222.333/0001-80')).toBe(false);
    expect(cnpjValido('12.ABC.345/01DE-36')).toBe(false);
    expect(validarCnpj('12.345.678/0001-96')).toBe('CNPJ inválido. Confira os dígitos.');
  });

  it('recusa 14 caracteres iguais, tamanho diferente de 14 e letras no DV', () => {
    expect(cnpjValido('00000000000000')).toBe(false);
    expect(cnpjValido('11111111111111')).toBe(false);
    expect(cnpjValido('1234567800019')).toBe(false);
    expect(cnpjValido('123456780001955')).toBe(false);
    expect(cnpjValido('12ABC34501DEAB')).toBe(false);
  });

  it('pede o CNPJ quando vazio', () => {
    expect(validarCnpj('')).toBe('Informe o CNPJ.');
  });

  it('formata com a máscara XX.XXX.XXX/XXXX-XX', () => {
    expect(formatarCnpj('12345678000195')).toBe('12.345.678/0001-95');
    expect(formatarCnpj('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
  });

  it('aplica a máscara de forma progressiva ao digitar', () => {
    expect(mascararCnpjDigitado('12')).toBe('12');
    expect(mascararCnpjDigitado('123')).toBe('12.3');
    expect(mascararCnpjDigitado('123456')).toBe('12.345.6');
    expect(mascararCnpjDigitado('123456780')).toBe('12.345.678/0');
    expect(mascararCnpjDigitado('1234567800019')).toBe('12.345.678/0001-9');
    expect(mascararCnpjDigitado('12abc34501de35')).toBe('12.ABC.345/01DE-35');
    expect(mascararCnpjDigitado('12.345.678/0001-9599')).toBe('12.345.678/0001-95');
  });
});
