import { http, HttpResponse } from 'msw';
import { agoraIso, db, novoId, paraTipo, type TipoDb } from '../dados';
import {
  API,
  adicionarErro,
  booleano,
  exigirFluig,
  latencia,
  problema,
  texto,
  textoOpcional,
  validacao,
} from '../util';

function validarTipo(corpo: Record<string, unknown>, exigirAtivo: boolean) {
  const errors: Record<string, string[]> = {};
  const nome = texto(corpo.nome);
  const instrucoes = textoOpcional(corpo.instrucoes);
  if (nome.length < 3 || nome.length > 120) adicionarErro(errors, 'nome', 'Informe o nome (de 3 a 120 caracteres).');
  if (instrucoes && instrucoes.length > 1000) adicionarErro(errors, 'instrucoes', 'As instruções podem ter até 1000 caracteres.');
  if (exigirAtivo && typeof corpo.ativo !== 'boolean') adicionarErro(errors, 'ativo', 'Informe se o tipo está ativo.');
  if (Object.keys(errors).length) return validacao(errors);
  return { nome, instrucoes, ativo: corpo.ativo as boolean | undefined };
}

const nomeDuplicado = (nome: string, ignorarId?: string) =>
  db.tipos.some((t) => t.id !== ignorarId && t.nome.toLowerCase() === nome.toLowerCase());

export const handlersTiposDocumento = [
  http.get(`${API}/tipos-documento`, async ({ request }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const ativo = booleano(new URL(request.url).searchParams.get('ativo'));
    const lista = db.tipos
      .filter((t) => ativo === undefined || t.ativo === ativo)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map(paraTipo);
    return HttpResponse.json(lista);
  }),

  http.post(`${API}/tipos-documento`, async ({ request }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const dados = validarTipo((await request.json()) as Record<string, unknown>, false);
    if (dados instanceof HttpResponse) return dados;
    if (nomeDuplicado(dados.nome)) return problema('NOME_DUPLICADO');
    const tipo: TipoDb = { id: novoId(), nome: dados.nome, instrucoes: dados.instrucoes, ativo: true, criadoEm: agoraIso() };
    db.tipos.push(tipo);
    return HttpResponse.json(paraTipo(tipo), {
      status: 201,
      headers: { Location: `/api/fluig/tipos-documento/${tipo.id}` },
    });
  }),

  http.get(`${API}/tipos-documento/:tipoId`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const tipo = db.tipos.find((t) => t.id === params.tipoId);
    return tipo ? HttpResponse.json(paraTipo(tipo)) : problema('NAO_ENCONTRADO');
  }),

  http.put(`${API}/tipos-documento/:tipoId`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const tipo = db.tipos.find((t) => t.id === params.tipoId);
    if (!tipo) return problema('NAO_ENCONTRADO');
    const dados = validarTipo((await request.json()) as Record<string, unknown>, true);
    if (dados instanceof HttpResponse) return dados;
    if (nomeDuplicado(dados.nome, tipo.id)) return problema('NOME_DUPLICADO');
    Object.assign(tipo, { nome: dados.nome, instrucoes: dados.instrucoes, ativo: dados.ativo });
    return HttpResponse.json(paraTipo(tipo));
  }),
];
