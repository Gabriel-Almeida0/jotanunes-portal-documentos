import { http, HttpResponse } from 'msw';
import type { ObraDetalhe, ObraResumo, Problema, Uf } from '../../api/tipos';
import { UFS } from '../../utils/formatos';
import {
  agoraIso,
  db,
  enviosDe,
  novoId,
  obraTemPendencia,
  paraDocumentoSituacao,
  paraEmpresaNaObra,
  paraEnvio,
  paraObra,
  paraPeriodo,
  periodosDe,
  paraTipoExigidoObra,
  paraVinculoEncerrado,
  tiposMarcadosAtivos,
  vinculoDe,
  vinculosAtivosDaObra,
  type ObraDb,
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
  sessaoDe,
  simplificar,
  texto,
  textoOpcional,
  validacao,
} from '../util';

interface DadosObra {
  nome: string;
  codigo: string | null;
  cidade: string;
  uf: Uf;
  ativa?: boolean;
}

function validarObra(corpo: Record<string, unknown>, exigirAtiva: boolean): DadosObra | HttpResponse<Problema> {
  const errors: Record<string, string[]> = {};
  const nome = texto(corpo.nome);
  const cidade = texto(corpo.cidade);
  const codigo = textoOpcional(corpo.codigo);
  const uf = texto(corpo.uf).toUpperCase();
  if (nome.length < 3 || nome.length > 150) adicionarErro(errors, 'nome', 'Informe o nome da obra (de 3 a 150 caracteres).');
  if (cidade.length < 2 || cidade.length > 100) adicionarErro(errors, 'cidade', 'Informe a cidade (de 2 a 100 caracteres).');
  if (!(UFS as readonly string[]).includes(uf)) adicionarErro(errors, 'uf', 'Escolha uma UF válida.');
  if (codigo && codigo.length > 30) adicionarErro(errors, 'codigo', 'O código pode ter até 30 caracteres.');
  if (exigirAtiva && typeof corpo.ativa !== 'boolean') adicionarErro(errors, 'ativa', 'Informe se a obra está ativa.');
  if (Object.keys(errors).length) return validacao(errors);
  return { nome, cidade, codigo, uf: uf as Uf, ativa: corpo.ativa as boolean | undefined };
}

function codigoDuplicado(codigo: string | null, ignorarId?: string): boolean {
  if (!codigo) return false;
  return db.obras.some((o) => o.id !== ignorarId && o.codigo?.toUpperCase() === codigo.toUpperCase());
}

function resumo(o: ObraDb): ObraResumo {
  return {
    ...paraObra(o),
    quantidadeEmpresas: vinculosAtivosDaObra(o.id).length,
    quantidadeTiposExigidos: tiposMarcadosAtivos(o.id).length,
  };
}

const porRazaoSocial = (a: { razaoSocial: string }, b: { razaoSocial: string }) =>
  a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR');

function detalhe(o: ObraDb): ObraDetalhe {
  const daObra = db.vinculos.filter((v) => v.obraId === o.id);
  const empresaDe = (id: string) => db.empresas.find((x) => x.id === id)!;
  const empresas = daObra
    .filter((v) => v.ativo)
    .map((v) => paraEmpresaNaObra(empresaDe(v.empresaId), v))
    .sort(porRazaoSocial);
  const vinculosEncerrados = daObra
    .filter((v) => !v.ativo)
    .map((v) => paraVinculoEncerrado(empresaDe(v.empresaId), v))
    .sort(porRazaoSocial);
  return { ...paraObra(o), empresas, vinculosEncerrados, quantidadeTiposExigidos: tiposMarcadosAtivos(o.id).length };
}

const loginDe = (request: Request) => sessaoDe(request)?.usuario.login ?? 'desconhecido';

export const handlersObras = [
  http.get(`${API}/obras`, async ({ request }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const url = new URL(request.url);
    const busca = simplificar(url.searchParams.get('busca'));
    const ativa = booleano(url.searchParams.get('ativa'));
    const comPendencia = booleano(url.searchParams.get('comPendencia'));
    const lista = db.obras
      .filter((o) => ativa === undefined || o.ativa === ativa)
      .filter((o) => comPendencia !== true || obraTemPendencia(o))
      .filter((o) => !busca || [o.nome, o.codigo, o.cidade].some((c) => simplificar(c).includes(busca)))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map(resumo);
    const pagina = paginar(lista, url);
    return pagina instanceof HttpResponse ? pagina : HttpResponse.json(pagina);
  }),

  http.post(`${API}/obras`, async ({ request }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin(request);
    if (negado) return negado;
    const dados = validarObra((await request.json()) as Record<string, unknown>, false);
    if (dados instanceof HttpResponse) return dados;
    if (codigoDuplicado(dados.codigo)) return problema('CODIGO_OBRA_DUPLICADO');
    const obra: ObraDb = { id: novoId(), nome: dados.nome, codigo: dados.codigo, cidade: dados.cidade, uf: dados.uf, ativa: true, criadoEm: agoraIso() };
    db.obras.push(obra);
    return HttpResponse.json(paraObra(obra), {
      status: 201,
      headers: { Location: `/api/fluig/obras/${obra.id}` },
    });
  }),

  http.get(`${API}/obras/:obraId`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const obra = db.obras.find((o) => o.id === params.obraId);
    return obra ? HttpResponse.json(detalhe(obra)) : problema('NAO_ENCONTRADO');
  }),

  http.put(`${API}/obras/:obraId`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin(request);
    if (negado) return negado;
    const obra = db.obras.find((o) => o.id === params.obraId);
    if (!obra) return problema('NAO_ENCONTRADO');
    const dados = validarObra((await request.json()) as Record<string, unknown>, true);
    if (dados instanceof HttpResponse) return dados;
    if (codigoDuplicado(dados.codigo, obra.id)) return problema('CODIGO_OBRA_DUPLICADO');
    Object.assign(obra, { nome: dados.nome, codigo: dados.codigo, cidade: dados.cidade, uf: dados.uf, ativa: dados.ativa });
    return HttpResponse.json(paraObra(obra));
  }),

  http.put(`${API}/obras/:obraId/empresas/:empresaId`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin(request);
    if (negado) return negado;
    const obra = db.obras.find((o) => o.id === params.obraId);
    const empresa = db.empresas.find((e) => e.id === params.empresaId);
    if (!obra || !empresa) return problema('NAO_ENCONTRADO');
    const existente = vinculoDe(obra.id, empresa.id);
    if (!existente) {
      db.vinculos.push({ obraId: obra.id, empresaId: empresa.id, vinculadoEm: agoraIso(), ativo: true, encerradoEm: null, encerradoPorLogin: null });
    } else if (!existente.ativo) {
      // Reabre o mesmo vínculo: histórico e situações anteriores voltam a valer (FR-221).
      Object.assign(existente, { ativo: true, encerradoEm: null, encerradoPorLogin: null, vinculadoEm: agoraIso() });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(`${API}/obras/:obraId/empresas/:empresaId`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin(request);
    if (negado) return negado;
    const vinculo = vinculoDe(String(params.obraId), String(params.empresaId));
    if (!vinculo) return problema('NAO_ENCONTRADO');
    // Encerra em vez de apagar (FR-220); já encerrado → 204 sem mudança.
    if (vinculo.ativo) {
      Object.assign(vinculo, { ativo: false, encerradoEm: agoraIso(), encerradoPorLogin: loginDe(request) });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Tipos exigidos da obra (002, US1) ──
  http.get(`${API}/obras/:obraId/tipos-documento`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const obra = db.obras.find((o) => o.id === params.obraId);
    if (!obra) return problema('NAO_ENCONTRADO');
    const marcados = new Set(db.obraTipos.filter((m) => m.obraId === obra.id).map((m) => m.tipoDocumentoId));
    const lista = db.tipos
      .filter((t) => t.abrangencia === 'POR_OBRA' && (t.ativo || marcados.has(t.id)))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((t) => paraTipoExigidoObra(obra.id, t));
    return HttpResponse.json(lista);
  }),

  http.put(`${API}/obras/:obraId/tipos-documento/:tipoId`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin(request);
    if (negado) return negado;
    const obra = db.obras.find((o) => o.id === params.obraId);
    const tipo = db.tipos.find((t) => t.id === params.tipoId);
    if (!obra || !tipo) return problema('NAO_ENCONTRADO');
    if (tipo.abrangencia !== 'POR_OBRA') return problema('TIPO_NAO_E_POR_OBRA');
    if (!db.obraTipos.some((m) => m.obraId === obra.id && m.tipoDocumentoId === tipo.id)) {
      db.obraTipos.push({ obraId: obra.id, tipoDocumentoId: tipo.id, marcadoEm: agoraIso(), marcadoPorLogin: loginDe(request) });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(`${API}/obras/:obraId/tipos-documento/:tipoId`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin(request);
    if (negado) return negado;
    const obra = db.obras.find((o) => o.id === params.obraId);
    const tipo = db.tipos.find((t) => t.id === params.tipoId);
    if (!obra || !tipo) return problema('NAO_ENCONTRADO');
    const i = db.obraTipos.findIndex((m) => m.obraId === obra.id && m.tipoDocumentoId === tipo.id);
    if (i >= 0) db.obraTipos.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Documentos da empresa na obra (002, US4); responde também com vínculo encerrado ──
  http.get(`${API}/obras/:obraId/empresas/:empresaId/documentos`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const obraId = String(params.obraId);
    const empresaId = String(params.empresaId);
    if (!vinculoDe(obraId, empresaId)) return problema('NAO_ENCONTRADO');
    const lista = tiposMarcadosAtivos(obraId).map((t) => paraDocumentoSituacao(empresaId, t, obraId));
    return HttpResponse.json(lista);
  }),

  http.get(`${API}/obras/:obraId/empresas/:empresaId/documentos/:tipoId/envios`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const obraId = String(params.obraId);
    const empresaId = String(params.empresaId);
    const tipo = db.tipos.find((t) => t.id === params.tipoId);
    if (!vinculoDe(obraId, empresaId) || !tipo || tipo.abrangencia !== 'POR_OBRA') return problema('NAO_ENCONTRADO');
    const periodoInicio = new URL(request.url).searchParams.get('periodoInicio');
    const envios = enviosDe(empresaId, tipo.id, obraId).filter((e) => !periodoInicio || e.periodoInicio === periodoInicio);
    return HttpResponse.json(envios.map(paraEnvio));
  }),

  // 003: períodos do documento periódico da obra (responde também com vínculo encerrado).
  http.get(`${API}/obras/:obraId/empresas/:empresaId/documentos/:tipoId/periodos`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const obraId = String(params.obraId);
    const empresaId = String(params.empresaId);
    const tipo = db.tipos.find((t) => t.id === params.tipoId);
    const marcado = db.obraTipos.some((m) => m.obraId === obraId && m.tipoDocumentoId === tipo?.id);
    if (!vinculoDe(obraId, empresaId) || !tipo || !marcado || tipo.periodicidade.unidade === 'UNICA') {
      return problema('NAO_ENCONTRADO');
    }
    return HttpResponse.json(periodosDe(empresaId, tipo, obraId).map(paraPeriodo));
  }),
];
