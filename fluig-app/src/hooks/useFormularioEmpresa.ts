import { useState } from 'react';
import { ErroApi, mensagemDeErro } from '../api/client';
import type { Empresa, EmpresaInput } from '../api/tipos';
import { formatarCnpj, mascararCnpjDigitado, validarCnpj } from '../utils/cnpj';
import { EMAIL_VALIDO, formatarTelefone } from '../utils/formatos';

type CampoEmpresa = 'razaoSocial' | 'nomeFantasia' | 'cnpj' | 'emailContato' | 'nomeContato' | 'telefone';
export type ErrosEmpresa = Partial<Record<CampoEmpresa, string>>;

interface Valores {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  emailContato: string;
  nomeContato: string;
  telefone: string;
}

function valoresIniciais(empresa: Empresa | null): Valores {
  return {
    razaoSocial: empresa?.razaoSocial ?? '',
    nomeFantasia: empresa?.nomeFantasia ?? '',
    cnpj: empresa ? formatarCnpj(empresa.cnpj) : '',
    emailContato: empresa?.emailContato ?? '',
    nomeContato: empresa?.nomeContato ?? '',
    telefone: formatarTelefone(empresa?.telefone),
  };
}

/** Estado, validação no cliente e mapeamento de erros da API do formulário de empresa. */
export function useFormularioEmpresa(empresa: Empresa | null) {
  const [valores, setValores] = useState<Valores>(() => valoresIniciais(empresa));
  const [erros, setErros] = useState<ErrosEmpresa>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  function alterar(campo: CampoEmpresa, valor: string) {
    setValores((v) => ({ ...v, [campo]: campo === 'cnpj' ? mascararCnpjDigitado(valor) : valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }));
  }

  /** Valida no cliente; devolve os dados prontos para a API ou `null` se houver erro. */
  function validar(): EmpresaInput | null {
    const novos: ErrosEmpresa = {};
    const razaoSocial = valores.razaoSocial.trim();
    const email = valores.emailContato.trim().toLowerCase();
    const telefone = valores.telefone.replace(/\D/g, '');
    if (razaoSocial.length < 2 || razaoSocial.length > 200) novos.razaoSocial = 'Informe a razão social (de 2 a 200 caracteres).';
    const erroCnpj = validarCnpj(valores.cnpj);
    if (erroCnpj) novos.cnpj = erroCnpj;
    if (!email) novos.emailContato = 'Informe o e-mail de contato.';
    else if (!EMAIL_VALIDO.test(email) || email.length > 254) novos.emailContato = 'E-mail inválido. Confira se está completo.';
    if (telefone && (telefone.length < 10 || telefone.length > 11)) novos.telefone = 'Informe DDD + número (10 ou 11 dígitos).';
    setErros(novos);
    setErroGeral(null);
    if (Object.keys(novos).length) return null;
    return {
      razaoSocial,
      nomeFantasia: valores.nomeFantasia.trim() || null,
      cnpj: valores.cnpj,
      emailContato: email,
      nomeContato: valores.nomeContato.trim() || null,
      telefone: telefone || null,
    };
  }

  function tratarErro(erro: unknown) {
    if (erro instanceof ErroApi && (erro.code === 'CNPJ_DUPLICADO' || erro.code === 'CNPJ_IMUTAVEL')) {
      setErros({ cnpj: erro.title });
      return;
    }
    if (erro instanceof ErroApi && erro.code === 'VALIDACAO') {
      const campos: CampoEmpresa[] = ['razaoSocial', 'nomeFantasia', 'cnpj', 'emailContato', 'nomeContato', 'telefone'];
      const porCampo: ErrosEmpresa = {};
      for (const c of campos) porCampo[c] = erro.erroDoCampo(c);
      setErros(porCampo);
      setErroGeral(erro.title);
      return;
    }
    setErroGeral(mensagemDeErro(erro));
  }

  function redefinir(novaEmpresa: Empresa | null) {
    setValores(valoresIniciais(novaEmpresa));
    setErros({});
    setErroGeral(null);
  }

  return { valores, erros, erroGeral, alterar, validar, tratarErro, redefinir };
}
