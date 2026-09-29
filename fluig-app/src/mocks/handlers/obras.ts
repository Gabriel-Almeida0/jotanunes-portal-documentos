import { http, HttpResponse } from 'msw';
import type { ObraDetalhe, ObraResumo, Problema, Uf } from '../../api/tipos';
import { UFS } from '../../utils/formatos';
import { agoraIso, db, novoId, paraEmpresaNaObra, paraObra, type ObraDb } from '../dados';
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
  return { ...paraObra(o), quantidadeEmpresas: db.vinculos.filter((v) => v.obraId === o.id).length };
}

function detalhe(o: ObraDb): ObraDetalhe {
  const empresas = db.vinculos
    .filter((v) => v.obraId === o.id)
    .map((v) => {
      const e = db.empresas.find((x) => x.id === v.empresaId)!;
      return paraEmpresaNaObra(e, v);
    })
    .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial, 'pt-BR'));
  return { ...paraObra(o), empresas };
}

export const handlersObras = [
  http.get(`${API}/obras`, async ({ request }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const url = new URL(request.url);
    const busca = simplificar(url.searchParams.get('busca'));
    const ativa = booleano(url.searchParams.get('ativa'));
    const lista = db.obras
      .filter((o) => ativa === undefined || o.ativa === ativa)
      .filter((o) => !busca || [o.nome, o.codigo, o.cidade].some((c) => simplificar(c).includes(busca)))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map(resumo);
    const pagina = paginar(lista, url);
    return pagina instanceof HttpResponse ? pagina : HttpResponse.json(pagina);
  }),

  http.post(`${API}/obras`, async ({ request }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin();
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
    const negado = exigirFluig(request) ?? exigirAdmin();
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
    const negado = exigirFluig(request) ?? exigirAdmin();
    if (negado) return negado;
    const obra = db.obras.find((o) => o.id === params.obraId);
    const empresa = db.empresas.find((e) => e.id === params.empresaId);
    if (!obra || !empresa) return problema('NAO_ENCONTRADO');
    if (!db.vinculos.some((v) => v.obraId === obra.id && v.empresaId === empresa.id)) {
      db.vinculos.push({ obraId: obra.id, empresaId: empresa.id, vinculadoEm: agoraIso() });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(`${API}/obras/:obraId/empresas/:empresaId`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin();
    if (negado) return negado;
    const i = db.vinculos.findIndex((v) => v.obraId === params.obraId && v.empresaId === params.empresaId);
    if (i < 0) return problema('NAO_ENCONTRADO');
    db.vinculos.splice(i, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
