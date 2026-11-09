import { http, HttpResponse } from 'msw';
import type { Abrangencia, Periodicidade, UnidadePeriodicidade } from '../../api/tipos';
import { agoraIso, db, novoId, paraTipo, type TipoDb } from '../dados';
import {
  API,
  adicionarErro,
  booleano,
  exigirAdmin,
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
  if (!ABRANGENCIAS.includes(corpo.abrangencia as Abrangencia)) {
    adicionarErro(errors, 'abrangencia', 'Escolha a abrangência: geral da empresa ou por obra.');
  }
  if (exigirAtivo && typeof corpo.ativo !== 'boolean') adicionarErro(errors, 'ativo', 'Informe se o tipo está ativo.');
  const periodicidade = validarPeriodicidade(corpo.periodicidade, errors);
  if (Object.keys(errors).length) return validacao(errors);
  return {
    nome,
    instrucoes,
    abrangencia: corpo.abrangencia as Abrangencia,
    ativo: corpo.ativo as boolean | undefined,
    periodicidade,
  };
}

const UNIDADES: UnidadePeriodicidade[] = ['UNICA', 'MESES', 'DIAS'];
const inteiroEntre = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** 003: omitida = UNICA; MESES 1–24, DIAS 1–365; prazo 0–90 (null se UNICA). */
function validarPeriodicidade(valor: unknown, errors: Record<string, string[]>): Periodicidade {
  if (valor === undefined || valor === null) return { unidade: 'UNICA', intervalo: null, prazoDias: null };
  const p = valor as Record<string, unknown>;
  const unidade = p.unidade as UnidadePeriodicidade;
  if (!UNIDADES.includes(unidade)) {
    adicionarErro(errors, 'periodicidade.unidade', 'Escolha a periodicidade.');
    return { unidade: 'UNICA', intervalo: null, prazoDias: null };
  }
  if (unidade === 'UNICA') return { unidade, intervalo: null, prazoDias: null };
  const max = unidade === 'MESES' ? 24 : 365;
  if (!inteiroEntre(p.intervalo, 1, max)) {
    adicionarErro(errors, 'periodicidade.intervalo', unidade === 'MESES' ? 'Informe de 1 a 24 meses.' : 'Informe de 1 a 365 dias.');
  }
  if (!inteiroEntre(p.prazoDias, 0, 90)) adicionarErro(errors, 'periodicidade.prazoDias', 'Informe o prazo de 0 a 90 dias.');
  return { unidade, intervalo: p.intervalo as number, prazoDias: p.prazoDias as number };
}

const ABRANGENCIAS: Abrangencia[] = ['GERAL', 'POR_OBRA'];

const nomeDuplicado = (nome: string, ignorarId?: string) =>
  db.tipos.some((t) => t.id !== ignorarId && t.nome.toLowerCase() === nome.toLowerCase());

export const handlersTiposDocumento = [
  http.get(`${API}/tipos-documento`, async ({ request }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const url = new URL(request.url);
    const ativo = booleano(url.searchParams.get('ativo'));
    const abrangencia = url.searchParams.get('abrangencia');
    const periodico = booleano(url.searchParams.get('periodico'));
    if (abrangencia && !ABRANGENCIAS.includes(abrangencia as Abrangencia)) {
      return validacao({ abrangencia: ['Abrangência inválida.'] });
    }
    const lista = db.tipos
      .filter((t) => ativo === undefined || t.ativo === ativo)
      .filter((t) => !abrangencia || t.abrangencia === abrangencia)
      .filter((t) => periodico === undefined || (t.periodicidade.unidade !== 'UNICA') === periodico)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map(paraTipo);
    return HttpResponse.json(lista);
  }),

  http.post(`${API}/tipos-documento`, async ({ request }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin(request);
    if (negado) return negado;
    const dados = validarTipo((await request.json()) as Record<string, unknown>, false);
    if (dados instanceof HttpResponse) return dados;
    if (nomeDuplicado(dados.nome)) return problema('NOME_DUPLICADO');
    const criadoEm = agoraIso();
    const tipo: TipoDb = { id: novoId(), nome: dados.nome, instrucoes: dados.instrucoes, abrangencia: dados.abrangencia, periodicidade: dados.periodicidade, ativo: true, criadoEm, cobrancaDesde: criadoEm };
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
    const negado = exigirFluig(request) ?? exigirAdmin(request);
    if (negado) return negado;
    const tipo = db.tipos.find((t) => t.id === params.tipoId);
    if (!tipo) return problema('NAO_ENCONTRADO');
    const dados = validarTipo((await request.json()) as Record<string, unknown>, true);
    if (dados instanceof HttpResponse) return dados;
    if (nomeDuplicado(dados.nome, tipo.id)) return problema('NOME_DUPLICADO');
    const temEnvios = db.envios.some((e) => e.tipoDocumentoId === tipo.id);
    const antes = tipo.periodicidade;
    const mudouRegra = dados.periodicidade.unidade !== antes.unidade || (dados.periodicidade.intervalo ?? null) !== (antes.intervalo ?? null);
    // 003 (FR-303): unidade/intervalo só mudam sem envios; o prazo muda sempre.
    if (mudouRegra && temEnvios) return problema('PERIODICIDADE_IMUTAVEL');
    if (dados.abrangencia !== tipo.abrangencia) {
      // Só muda enquanto o tipo não tiver envios (FR-205); POR_OBRA → GERAL remove as marcações.
      if (db.envios.some((e) => e.tipoDocumentoId === tipo.id)) return problema('ABRANGENCIA_IMUTAVEL');
      if (dados.abrangencia === 'GERAL') {
        const resto = db.obraTipos.filter((m) => m.tipoDocumentoId !== tipo.id);
        db.obraTipos.splice(0, db.obraTipos.length, ...resto);
      }
    }
    // Reativar ou passar de única para periódico recomeça a cobrança (data-model §1).
    const reativado = dados.ativo === true && !tipo.ativo;
    const virouPeriodico = antes.unidade === 'UNICA' && dados.periodicidade.unidade !== 'UNICA';
    if (reativado || virouPeriodico) tipo.cobrancaDesde = agoraIso();
    Object.assign(tipo, {
      nome: dados.nome,
      instrucoes: dados.instrucoes,
      abrangencia: dados.abrangencia,
      ativo: dados.ativo,
      periodicidade: dados.periodicidade,
    });
    return HttpResponse.json(paraTipo(tipo));
  }),
];
