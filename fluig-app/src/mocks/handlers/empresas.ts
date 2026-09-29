import { http, HttpResponse } from 'msw';
import type { Problema, SituacaoAcesso } from '../../api/tipos';
import { cnpjValido, normalizarCnpj } from '../../utils/cnpj';
import { EMAIL_VALIDO } from '../../utils/formatos';
import {
  agoraIso,
  convitesDaEmpresa,
  db,
  novoId,
  paraEmpresa,
  paraEmpresaResumo,
  situacaoAcesso,
  temPendencia,
  type EmpresaDb,
} from '../dados';
import {
  API,
  adicionarErro,
  booleano,
  exigirAdmin,
  exigirFluig,
  latencia,
  paginar,
  problema,
  simplificar,
  texto,
  textoOpcional,
  validacao,
} from '../util';

const SITUACOES: SituacaoAcesso[] = ['NAO_CONVIDADA', 'CONVIDADA', 'CONVITE_EXPIRADO', 'ATIVA', 'DESATIVADA'];

interface DadosEmpresa {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  emailContato: string;
  nomeContato: string | null;
  telefone: string | null;
  ativa?: boolean;
}

function validarEmpresa(corpo: Record<string, unknown>, exigirAtiva: boolean): DadosEmpresa | HttpResponse<Problema> {
  const errors: Record<string, string[]> = {};
  const razaoSocial = texto(corpo.razaoSocial);
  const nomeFantasia = textoOpcional(corpo.nomeFantasia);
  const cnpjBruto = texto(corpo.cnpj);
  const emailContato = texto(corpo.emailContato).toLowerCase();
  const nomeContato = textoOpcional(corpo.nomeContato);
  const telefoneBruto = textoOpcional(corpo.telefone);
  const telefone = telefoneBruto ? telefoneBruto.replace(/\D/g, '') : null;

  if (razaoSocial.length < 2 || razaoSocial.length > 200) adicionarErro(errors, 'razaoSocial', 'Informe a razão social (de 2 a 200 caracteres).');
  if (nomeFantasia && nomeFantasia.length > 200) adicionarErro(errors, 'nomeFantasia', 'O nome fantasia pode ter até 200 caracteres.');
  if (!cnpjValido(cnpjBruto)) adicionarErro(errors, 'cnpj', 'CNPJ inválido.');
  if (!EMAIL_VALIDO.test(emailContato) || emailContato.length > 254) adicionarErro(errors, 'emailContato', 'E-mail inválido.');
  if (nomeContato && nomeContato.length > 150) adicionarErro(errors, 'nomeContato', 'O nome do contato pode ter até 150 caracteres.');
  if (telefone !== null && (telefone.length < 10 || telefone.length > 11)) adicionarErro(errors, 'telefone', 'O telefone deve ter DDD + número (10 ou 11 dígitos).');
  if (exigirAtiva && typeof corpo.ativa !== 'boolean') adicionarErro(errors, 'ativa', 'Informe se a empresa está ativa.');
  if (Object.keys(errors).length) return validacao(errors);
  return { razaoSocial, nomeFantasia, cnpj: normalizarCnpj(cnpjBruto), emailContato, nomeContato, telefone, ativa: corpo.ativa as boolean | undefined };
}

export const handlersEmpresas = [
  http.get(`${API}/empresas`, async ({ request }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const url = new URL(request.url);
    const buscaBruta = url.searchParams.get('busca') ?? '';
    const busca = simplificar(buscaBruta.trim());
    const buscaCnpj = normalizarCnpj(buscaBruta).replace(/[^0-9A-Z]/g, '');
    const obraId = url.searchParams.get('obraId');
    const situacao = url.searchParams.get('situacaoAcesso') as SituacaoAcesso | null;
    const comPendencia = booleano(url.searchParams.get('comPendencia'));
    if (situacao && !SITUACOES.includes(situacao)) {
      return validacao({ situacaoAcesso: ['Situação de acesso inválida.'] });
    }
    const lista = db.empresas
      .filter((e) =>
        !busca ||
        simplificar(e.razaoSocial).includes(busca) ||
        simplificar(e.nomeFantasia).includes(busca) ||
        (buscaCnpj.length >= 2 && e.cnpj.includes(buscaCnpj)),
      )
      .filter((e) => !obraId || db.vinculos.some((v) => v.obraId === obraId && v.empresaId === e.id))
      .filter((e) => !situacao || situacaoAcesso(e) === situacao)
      .filter((e) => comPendencia !== true || (e.ativa && temPendencia(e)))
      .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR'))
      .map(paraEmpresaResumo);
    const pagina = paginar(lista, url);
    return pagina instanceof HttpResponse ? pagina : HttpResponse.json(pagina);
  }),

  http.post(`${API}/empresas`, async ({ request }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin();
    if (negado) return negado;
    const dados = validarEmpresa((await request.json()) as Record<string, unknown>, false);
    if (dados instanceof HttpResponse) return dados;
    if (db.empresas.some((e) => e.cnpj === dados.cnpj)) return problema('CNPJ_DUPLICADO');
    const empresa: EmpresaDb = {
      id: novoId(),
      razaoSocial: dados.razaoSocial,
      nomeFantasia: dados.nomeFantasia,
      cnpj: dados.cnpj,
      emailContato: dados.emailContato,
      nomeContato: dados.nomeContato,
      telefone: dados.telefone,
      ativa: true,
      criadoEm: agoraIso(),
      trocaSenhaObrigatoria: false,
      senhaTemporariaExpiraEm: null,
      ultimoAcessoEm: null,
    };
    db.empresas.push(empresa);
    return HttpResponse.json(paraEmpresa(empresa), {
      status: 201,
      headers: { Location: `/api/fluig/empresas/${empresa.id}` },
    });
  }),

  http.get(`${API}/empresas/:empresaId`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const empresa = db.empresas.find((e) => e.id === params.empresaId);
    return empresa ? HttpResponse.json(paraEmpresa(empresa)) : problema('NAO_ENCONTRADO');
  }),

  http.put(`${API}/empresas/:empresaId`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin();
    if (negado) return negado;
    const empresa = db.empresas.find((e) => e.id === params.empresaId);
    if (!empresa) return problema('NAO_ENCONTRADO');
    const dados = validarEmpresa((await request.json()) as Record<string, unknown>, true);
    if (dados instanceof HttpResponse) return dados;
    if (dados.cnpj !== empresa.cnpj) {
      if (convitesDaEmpresa(empresa.id).length > 0) return problema('CNPJ_IMUTAVEL');
      if (db.empresas.some((e) => e.id !== empresa.id && e.cnpj === dados.cnpj)) return problema('CNPJ_DUPLICADO');
    }
    Object.assign(empresa, {
      razaoSocial: dados.razaoSocial,
      nomeFantasia: dados.nomeFantasia,
      cnpj: dados.cnpj,
      emailContato: dados.emailContato,
      nomeContato: dados.nomeContato,
      telefone: dados.telefone,
      ativa: dados.ativa,
    });
    return HttpResponse.json(paraEmpresa(empresa));
  }),
];
