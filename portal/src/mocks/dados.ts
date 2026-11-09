/**
 * Banco em memória dos mocks do portal. Segue os schemas do contrato (`openapi.yaml`).
 * Credenciais (quickstart §5): CNPJ 12.345.678/0001-95, senha temporária `Temp1234`
 * (troca obrigatória) e depois a senha nova (ex.: `Nova1234`).
 */
import type {
  Abrangencia,
  ContagemDocumentos,
  DocumentoSituacaoPortal,
  EmpresaPortal,
  EnvioPortal,
  FormatoArquivo,
  ObraPortal,
  Periodicidade,
  PeriodoComPrazo,
  PeriodoPortal,
  ResumoPeriodos,
  SituacaoDocumento,
} from '../api/tipos';

export const CNPJ_EXEMPLO = '12345678000195';
export const SENHA_TEMPORARIA_EXEMPLO = 'Temp1234';
export const SENHA_NOVA_EXEMPLO = 'Nova1234';
/** Token de convite válido (base64url, 43 caracteres) que pré-preenche o CNPJ de exemplo. */
export const TOKEN_CONVITE_VALIDO = 'convite-exemplo-valido-00000000000000000000';

export interface EmpresaMock {
  empresa: EmpresaPortal;
  senha: string;
  ativa: boolean;
  /** Senha temporária vencida → CONVITE_EXPIRADO no login. */
  conviteExpirado: boolean;
  tentativasFalhas: number;
  bloqueadoAte: string | null;
  versao: number;
  /** Cadastro da empresa (início da cobrança dos periódicos gerais, data-model 003 §3). */
  criadoEm: string;
}

export interface TipoMock {
  id: string;
  nome: string;
  instrucoes: string | null;
  abrangencia: Abrangencia;
  ativo: boolean;
  periodicidade: Periodicidade;
  /** Criação (ou reativação) do tipo: ninguém é cobrado por períodos anteriores. */
  cobrancaDesde: string;
}

export interface ObraMock {
  id: string;
  nome: string;
  cidade: string;
  uf: ObraPortal['uf'];
  ativa: boolean;
}

/** Vínculo empresa ↔ obra. Encerrado (`ativo=false`) some do portal, mas o histórico fica. */
export interface VinculoMock {
  obraId: string;
  empresaId: string;
  ativo: boolean;
  encerradoEm: string | null;
  vinculadoEm: string;
}

/** Tipo `POR_OBRA` marcado como exigido numa obra. */
export interface ObraTipoMock {
  obraId: string;
  tipoDocumentoId: string;
  marcadoEm: string;
}

export interface EnvioMock extends EnvioPortal {
  empresaId: string;
  /** Obra do envio (null = documento geral). */
  obraId: string | null;
  conteudo: Uint8Array;
}

interface Banco {
  empresas: EmpresaMock[];
  tipos: TipoMock[];
  obras: ObraMock[];
  vinculos: VinculoMock[];
  obraTipos: ObraTipoMock[];
  envios: EnvioMock[];
  /** token → empresa + versão da credencial no momento da emissão. */
  sessoes: Map<string, { empresaId: string; versao: number }>;
  convites: Map<string, string>;
  contador: number;
}

const PDF_MINIMO = new TextEncoder().encode(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
);

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}

function horasAtras(horas: number): string {
  return new Date(Date.now() - horas * 3_600_000).toISOString();
}

const DIAS_ATRAS_ANTIGO = 2 * 365 * 24;

// ---------------------------------------------------------------------------------------------
// Períodos (data-model 003 §3). Datas sem hora ("AAAA-MM-DD") no fuso de Brasília.
// ---------------------------------------------------------------------------------------------

const formatoDataLocal = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Data local (Brasília) de um instante ISO, como "AAAA-MM-DD". */
export function dataLocal(iso: string | Date = new Date()): string {
  return formatoDataLocal.format(typeof iso === 'string' ? new Date(iso) : iso);
}

function paraUtc(data: string): Date {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function deUtc(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function somarDias(data: string, dias: number): string {
  const d = paraUtc(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return deUtc(d);
}

function somarMeses(data: string, meses: number): string {
  const d = paraUtc(data);
  return deUtc(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, 1)));
}

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
const abreviado = (mes: number) => MESES[mes].slice(0, 3);

/** Rótulo pt-BR (research R9): "Março/2026", "Jan–Mar/2026", "2026", "Fev/2026–Jan/2027", "01/03 a 30/03/2026". */
function rotulo(periodicidade: Periodicidade, inicio: string, fim: string): string {
  const [ai, mi, di] = inicio.split('-').map(Number);
  const [af, mf, df] = fim.split('-').map(Number);
  if (periodicidade.unidade === 'DIAS') {
    const dm = (d: number, m: number) =>
      `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
    return ai === af
      ? `${dm(di, mi)} a ${dm(df, mf)}/${af}`
      : `${dm(di, mi)}/${ai} a ${dm(df, mf)}/${af}`;
  }
  const n = periodicidade.intervalo ?? 1;
  if (n === 1) return `${MESES[mi - 1]}/${ai}`;
  if (n === 12 && mi === 1) return `${ai}`;
  if (ai === af) return `${abreviado(mi - 1)}–${abreviado(mf - 1)}/${ai}`;
  return `${abreviado(mi - 1)}/${ai}–${abreviado(mf - 1)}/${af}`;
}

const NOMES_MESES: Record<number, string> = {
  1: 'Mensal',
  2: 'Bimestral',
  3: 'Trimestral',
  6: 'Semestral',
  12: 'Anual',
};

/** Descrição pt-BR da regra (no backend vem pronta em `periodicidade.descricao`). */
function descrever(unidade: Periodicidade['unidade'], intervalo: number, prazo: number): string {
  if (unidade === 'UNICA') return 'Único';
  if (unidade === 'MESES' && intervalo === 1) {
    return `Mensal · até o dia ${prazo} do mês seguinte`;
  }
  const nome =
    unidade === 'MESES'
      ? (NOMES_MESES[intervalo] ?? `A cada ${intervalo} meses`)
      : `A cada ${intervalo} dias`;
  return `${nome} · até ${prazo} dias após o fim do período`;
}

export function periodicidade(
  unidade: Periodicidade['unidade'] = 'UNICA',
  intervalo = 1,
  prazoDias = 15,
): Periodicidade {
  return unidade === 'UNICA'
    ? { unidade, intervalo: null, prazoDias: null, descricao: descrever(unidade, 0, 0) }
    : { unidade, intervalo, prazoDias, descricao: descrever(unidade, intervalo, prazoDias) };
}

/** Períodos exigidos, do primeiro (que contém o início da cobrança) ao que contém `hoje`. */
export function gerarPeriodos(
  regra: Periodicidade,
  inicioCobranca: string,
  hoje: string = dataLocal(),
): PeriodoComPrazo[] {
  if (regra.unidade === 'UNICA') return [];
  const n = regra.intervalo ?? 1;
  const prazoDias = regra.prazoDias ?? 0;
  const lista: PeriodoComPrazo[] = [];
  let inicio = regra.unidade === 'MESES' ? `${inicioCobranca.slice(0, 8)}01` : inicioCobranca;
  while (inicio <= hoje) {
    const proximoInicio = regra.unidade === 'MESES' ? somarMeses(inicio, n) : somarDias(inicio, n);
    const fim = somarDias(proximoInicio, -1);
    lista.push({
      inicio,
      fim,
      prazo: somarDias(fim, prazoDias),
      rotulo: rotulo(regra, inicio, fim),
    });
    inicio = proximoInicio;
  }
  return lista;
}

function empresa(
  n: number,
  razaoSocial: string,
  cnpj: string,
  senha: string,
  extras: Partial<EmpresaMock> = {},
  trocaSenhaObrigatoria = false,
): EmpresaMock {
  return {
    empresa: { id: uuid(n), razaoSocial, nomeFantasia: null, cnpj, trocaSenhaObrigatoria },
    senha,
    ativa: true,
    conviteExpirado: false,
    tentativasFalhas: 0,
    bloqueadoAte: null,
    versao: 1,
    criadoEm: horasAtras(DIAS_ATRAS_ANTIGO),
    ...extras,
  };
}

function envio(
  n: number,
  empresaId: string,
  tipoId: string,
  nomeArquivo: string,
  enviadoHa: number,
  status: EnvioPortal['status'],
  motivoRejeicao: string | null = null,
  obraId: string | null = null,
): EnvioMock {
  return {
    id: uuid(n),
    empresaId,
    obraId,
    tipoDocumentoId: tipoId,
    nomeArquivo,
    formato: 'application/pdf',
    tamanhoBytes: PDF_MINIMO.byteLength,
    enviadoEm: horasAtras(enviadoHa),
    status,
    analisadoEm: status === 'EM_ANALISE' ? null : horasAtras(enviadoHa - 20),
    motivoRejeicao,
    periodo: null,
    enviadoComAtraso: false,
    conteudo: PDF_MINIMO,
  };
}

/** Envio de um período (`p` vem de `gerarPeriodos`). */
function envioPeriodo(base: EnvioMock, p: PeriodoComPrazo, enviadoComAtraso = false): EnvioMock {
  return {
    ...base,
    periodo: { inicio: p.inicio, fim: p.fim, rotulo: p.rotulo },
    enviadoComAtraso,
  };
}

function tipo(
  n: number,
  nome: string,
  instrucoes: string | null,
  abrangencia: Abrangencia = 'GERAL',
  regra: Periodicidade = periodicidade(),
  cobrancaDesde: string = horasAtras(DIAS_ATRAS_ANTIGO),
): TipoMock {
  return {
    id: uuid(n),
    nome,
    instrucoes,
    abrangencia,
    ativo: true,
    periodicidade: regra,
    cobrancaDesde,
  };
}

/** Instante de N meses atrás (mesmo dia, meio-dia em Brasília). */
function mesesAtras(meses: number): string {
  const [a, m, d] = dataLocal().split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 - meses, 1, 15));
  const ultimoDia = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0),
  ).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDia));
  return alvo.toISOString();
}

function obra(
  n: number,
  nome: string,
  cidade: string,
  uf: ObraPortal['uf'],
  ativa = true,
): ObraMock {
  return { id: uuid(n), nome, cidade, uf, ativa };
}

function criarBanco(): Banco {
  const tipos: TipoMock[] = [
    tipo(
      101,
      'Cartão CNPJ',
      'Comprovante de inscrição emitido no site da Receita Federal há no máximo 30 dias.',
    ),
    tipo(
      102,
      'Certidão Negativa de Débitos Federais',
      'Certidão conjunta da Receita Federal e da PGFN, dentro da validade.',
    ),
    tipo(
      103,
      'PCMSO',
      'Programa de Controle Médico de Saúde Ocupacional assinado pelo médico responsável.',
    ),
    // Por obra: cada obra que marca o tipo exige o seu próprio envio.
    tipo(
      111,
      'ART da obra',
      'Anotação de Responsabilidade Técnica registrada no CREA para esta obra.',
      'POR_OBRA',
    ),
    tipo(112, 'Ordem de serviço', 'Ordem de serviço assinada pelo engenheiro da obra.', 'POR_OBRA'),
    // Por obra, mas não marcado em nenhuma obra: não aparece em lugar nenhum.
    tipo(113, 'Plano de rigging', 'Plano de içamento de cargas assinado.', 'POR_OBRA'),
    // Periódicos (feature 003): geral mensal cobrado desde 3 meses atrás (4 períodos com o atual) e
    // por obra trimestral (marcado no Edifício Atlântico há 7 meses).
    tipo(
      104,
      'Guia do FGTS',
      'Guia de recolhimento do FGTS do mês, com o comprovante de pagamento.',
      'GERAL',
      periodicidade('MESES', 1, 15),
      mesesAtras(3),
    ),
    tipo(
      114,
      'Relatório trimestral de segurança',
      'Relatório de segurança do trabalho do trimestre, assinado pelo técnico de segurança.',
      'POR_OBRA',
      periodicidade('MESES', 3, 10),
    ),
  ];

  const obras: ObraMock[] = [
    obra(501, 'Residencial Parque das Flores', 'Aracaju', 'SE'),
    obra(502, 'Edifício Atlântico', 'Maceió', 'AL'),
    // Vínculo da Alfa encerrado: some do portal (histórico preservado na área Jotanunes).
    obra(503, 'Condomínio Mar Azul', 'Salvador', 'BA'),
    // Obra desativada: some do portal mesmo com vínculo ativo.
    obra(504, 'Torre Empresarial Centro', 'Aracaju', 'SE', false),
    // Delta: tudo aprovado / nenhum tipo exigido.
    obra(505, 'Condomínio Vila Real', 'Lagarto', 'SE'),
    obra(506, 'Galpão Logístico Norte', 'Nossa Senhora do Socorro', 'SE'),
  ];

  const empresas: EmpresaMock[] = [
    // Primeiro acesso: troca obrigatória; 3 documentos pendentes.
    empresa(
      1,
      'Exemplo Serviços de Engenharia Ltda',
      CNPJ_EXEMPLO,
      SENHA_TEMPORARIA_EXEMPLO,
      // Cadastrada agora: dos periódicos, só o período em curso é cobrado.
      { criadoEm: horasAtras(0) },
      true,
    ),
    // Ativa, com documentos em todas as situações (rejeitado, em análise, aprovado).
    empresa(2, 'Alfa Engenharia Ltda', '11222333000181', 'Alfa2026ok'),
    // Convite vencido (senha temporária expirada) — CNPJ alfanumérico.
    empresa(
      3,
      'Beta Serviços Ltda',
      '12ABC34501DE35',
      SENHA_TEMPORARIA_EXEMPLO,
      { conviteExpirado: true },
      true,
    ),
    // Desativada pela Jotanunes.
    empresa(4, 'Gama Montagens Ltda', '33444555000181', 'Gama2026ok', { ativa: false }),
    // Tudo aprovado → estado vazio "Nenhum documento pendente".
    empresa(5, 'Delta Instalações Ltda', '99888777000100', 'Delta2026ok'),
  ];

  const alfa = empresas[1].empresa.id;
  const delta = empresas[4].empresa.id;
  const [parque, atlantico, marAzul, torre, vilaReal, galpao] = obras.map((o) => o.id);
  const [art, ordemServico] = [tipos[3].id, tipos[4].id];
  const [fgts, trimestral] = [tipos[6], tipos[7]];

  const antigo = horasAtras(DIAS_ATRAS_ANTIGO);
  const vinculo = (obraId: string, empresaId: string, ativo = true): VinculoMock => ({
    obraId,
    empresaId,
    ativo,
    encerradoEm: ativo ? null : horasAtras(48),
    vinculadoEm: antigo,
  });
  const vinculos: VinculoMock[] = [
    vinculo(parque, alfa),
    vinculo(atlantico, alfa),
    vinculo(marAzul, alfa, false),
    vinculo(torre, alfa),
    vinculo(vilaReal, delta),
    vinculo(galpao, delta),
  ];

  const marcacao = (obraId: string, tipoDocumentoId: string, marcadoEm = antigo) => ({
    obraId,
    tipoDocumentoId,
    marcadoEm,
  });
  const obraTipos: ObraTipoMock[] = [
    marcacao(parque, art),
    marcacao(parque, ordemServico),
    marcacao(atlantico, art),
    marcacao(atlantico, ordemServico),
    marcacao(atlantico, trimestral.id, mesesAtras(7)),
    marcacao(marAzul, art),
    marcacao(torre, art),
    marcacao(vilaReal, art),
  ];

  // Períodos do FGTS (iguais para Alfa e Delta): [3 meses atrás, 2, 1, mês atual].
  const pFgts = gerarPeriodos(fgts.periodicidade, dataLocal(fgts.cobrancaDesde));
  // Trimestres do relatório no Atlântico: [há 2 trimestres, anterior, atual].
  const pTri = gerarPeriodos(trimestral.periodicidade, dataLocal(mesesAtras(7)));
  const envios: EnvioMock[] = [
    envio(
      201,
      alfa,
      tipos[0].id,
      'cartao-cnpj-alfa.pdf',
      96,
      'REJEITADO',
      'Documento ilegível, envie de novo.',
    ),
    envio(202, alfa, tipos[1].id, 'cnd-federal-alfa.pdf', 30, 'EM_ANALISE'),
    envio(
      203,
      alfa,
      tipos[2].id,
      'pcmso-2026-alfa.pdf',
      120,
      'REJEITADO',
      'Falta a assinatura do médico responsável.',
    ),
    envio(204, alfa, tipos[2].id, 'pcmso-2026-alfa-assinado.pdf', 72, 'APROVADO'),
    envio(301, delta, tipos[0].id, 'cartao-cnpj.pdf', 200, 'APROVADO'),
    envio(302, delta, tipos[1].id, 'cnd.pdf', 200, 'APROVADO'),
    envio(303, delta, tipos[2].id, 'pcmso.pdf', 200, 'APROVADO'),
    // Por obra (Alfa): Parque das Flores com ART rejeitada e OS em análise; Atlântico com OS aprovada
    // e ART pendente; Mar Azul (vínculo encerrado) com ART aprovada.
    envio(
      401,
      alfa,
      art,
      'art-parque-das-flores.pdf',
      80,
      'REJEITADO',
      'ART sem a assinatura do contratante.',
      parque,
    ),
    envio(402, alfa, ordemServico, 'os-parque-das-flores.pdf', 20, 'EM_ANALISE', null, parque),
    envio(403, alfa, ordemServico, 'os-atlantico.pdf', 150, 'APROVADO', null, atlantico),
    envio(404, alfa, art, 'art-mar-azul.pdf', 300, 'APROVADO', null, marAzul),
    envio(405, delta, art, 'art-vila-real.pdf', 200, 'APROVADO', null, vilaReal),
    // FGTS da Alfa: 1º período aprovado (enviado com atraso), 2º sem envio (atrasado), 3º rejeitado
    // (atrasado) e o atual em análise → "2 atrasados · 1 em análise".
    envioPeriodo(envio(501, alfa, fgts.id, 'fgts-alfa-1.pdf', 1500, 'APROVADO'), pFgts[0], true),
    envioPeriodo(
      envio(
        502,
        alfa,
        fgts.id,
        'fgts-alfa-3.pdf',
        400,
        'REJEITADO',
        'Falta o comprovante de pagamento.',
      ),
      pFgts[2],
    ),
    envioPeriodo(envio(503, alfa, fgts.id, 'fgts-alfa-4.pdf', 10, 'EM_ANALISE'), pFgts[3]),
    // Delta: tudo aprovado, inclusive os períodos do FGTS.
    ...pFgts.map((p, i) =>
      envioPeriodo(envio(510 + i, delta, fgts.id, `fgts-delta-${i + 1}.pdf`, 30, 'APROVADO'), p),
    ),
    // Relatório trimestral da Alfa no Atlântico: 1º aprovado, 2º rejeitado (atrasado), atual pendente.
    envioPeriodo(
      envio(520, alfa, trimestral.id, 'relatorio-tri-1.pdf', 3000, 'APROVADO', null, atlantico),
      pTri[0],
    ),
    envioPeriodo(
      envio(
        521,
        alfa,
        trimestral.id,
        'relatorio-tri-2.pdf',
        1200,
        'REJEITADO',
        'Relatório sem a assinatura do técnico de segurança.',
        atlantico,
      ),
      pTri[1],
    ),
  ];

  return {
    empresas,
    tipos,
    obras,
    vinculos,
    obraTipos,
    envios,
    sessoes: new Map(),
    convites: new Map([[TOKEN_CONVITE_VALIDO, empresas[0].empresa.id]]),
    contador: 1000,
  };
}

export let banco: Banco = criarBanco();

/** Volta os dados ao estado inicial (usado entre testes). */
export function resetarDados(): void {
  banco = criarBanco();
}

export function proximoId(): string {
  banco.contador += 1;
  return uuid(banco.contador);
}

export function emitirToken(emp: EmpresaMock): string {
  const token = `mock.${emp.empresa.id}.${emp.versao}.${proximoId()}`;
  banco.sessoes.set(token, { empresaId: emp.empresa.id, versao: emp.versao });
  return token;
}

export function empresaDoToken(authorization: string | null): EmpresaMock | null {
  const token = authorization?.replace(/^Bearer\s+/i, '') ?? '';
  // O token carrega empresa e versão: continua valendo depois de recarregar a página (os dados do
  // mock voltam ao estado inicial, mas as empresas já ativas seguem conectadas).
  const partes = /^mock\.([0-9a-f-]{36})\.(\d+)\./.exec(token);
  const sessao =
    banco.sessoes.get(token) ??
    (partes ? { empresaId: partes[1], versao: Number(partes[2]) } : undefined);
  if (!sessao) return null;
  const emp = banco.empresas.find((e) => e.empresa.id === sessao.empresaId);
  if (!emp || !emp.ativa || emp.versao !== sessao.versao) return null;
  return emp;
}

const ORDEM: Record<SituacaoDocumento, number> = {
  REJEITADO: 0,
  PENDENTE_ENVIO: 1,
  EM_ANALISE: 2,
  APROVADO: 3,
};

function semConteudo(envio: EnvioMock): EnvioPortal {
  const copia: Partial<EnvioMock> = { ...envio };
  delete copia.conteudo;
  delete copia.empresaId;
  return copia as EnvioPortal;
}

/**
 * Envios da empresa para o tipo no contexto (`obraId` null = geral), mais recente primeiro;
 * `periodoInicio` filtra os de um período.
 */
export function enviosDoDocumento(
  empresaId: string,
  tipoId: string,
  obraId: string | null,
  periodoInicio?: string | null,
): EnvioPortal[] {
  return banco.envios
    .filter((e) => e.empresaId === empresaId && e.tipoDocumentoId === tipoId && e.obraId === obraId)
    .filter((e) => !periodoInicio || e.periodo?.inicio === periodoInicio)
    .sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm))
    .map(semConteudo);
}

const maisRecente = (a: string, b: string) => (a > b ? a : b);

/** Início da cobrança (data local) do tipo para a empresa no contexto (data-model 003 §3). */
function inicioCobranca(empresaId: string, tipo: TipoMock, obraId: string | null): string {
  if (obraId === null) {
    const emp = banco.empresas.find((e) => e.empresa.id === empresaId);
    return dataLocal(maisRecente(emp?.criadoEm ?? tipo.cobrancaDesde, tipo.cobrancaDesde));
  }
  const vinculo = banco.vinculos.find((v) => v.obraId === obraId && v.empresaId === empresaId);
  const marcacao = banco.obraTipos.find(
    (m) => m.obraId === obraId && m.tipoDocumentoId === tipo.id,
  );
  return dataLocal(
    [vinculo?.vinculadoEm, marcacao?.marcadoEm, tipo.cobrancaDesde]
      .filter((d): d is string => !!d)
      .reduce(maisRecente),
  );
}

const pedeEnvio = (s: SituacaoDocumento) => s === 'PENDENTE_ENVIO' || s === 'REJEITADO';

/** Períodos exigidos do documento periódico, do mais recente ao mais antigo. */
export function periodosDoDocumento(
  empresaId: string,
  tipo: TipoMock,
  obraId: string | null,
): PeriodoPortal[] {
  const hoje = dataLocal();
  const envios = enviosDoDocumento(empresaId, tipo.id, obraId);
  return gerarPeriodos(tipo.periodicidade, inicioCobranca(empresaId, tipo, obraId), hoje)
    .map((p): PeriodoPortal => {
      const atual = envios.find((e) => e.periodo?.inicio === p.inicio) ?? null;
      const situacao: SituacaoDocumento = atual ? atual.status : 'PENDENTE_ENVIO';
      return {
        ...p,
        situacao,
        atrasado: hoje > p.prazo && pedeEnvio(situacao),
        envioAtual: atual,
        podeEnviar: pedeEnvio(situacao),
      };
    })
    .reverse();
}

const PRIORIDADE: SituacaoDocumento[] = ['REJEITADO', 'PENDENTE_ENVIO', 'EM_ANALISE', 'APROVADO'];

function situacaoPeriodica(
  empresaId: string,
  tipo: TipoMock,
  obraId: string | null,
): Pick<
  DocumentoSituacaoPortal,
  'situacao' | 'envioAtual' | 'podeEnviar' | 'atrasado' | 'periodos'
> {
  const periodos = periodosDoDocumento(empresaId, tipo, obraId);
  const n = (s: SituacaoDocumento) => periodos.filter((p) => p.situacao === s).length;
  const antigos = [...periodos].reverse();
  const proximo = antigos.find((p) => p.podeEnviar);
  const resumo: ResumoPeriodos = {
    atrasados: periodos.filter((p) => p.atrasado).length,
    pendentes: n('PENDENTE_ENVIO'),
    rejeitados: n('REJEITADO'),
    emAnalise: n('EM_ANALISE'),
    aprovados: n('APROVADO'),
    proximo: proximo
      ? { inicio: proximo.inicio, fim: proximo.fim, prazo: proximo.prazo, rotulo: proximo.rotulo }
      : null,
  };
  // FR-312: algum atrasado → a situação desse período; senão a de maior prioridade.
  const escolhido =
    antigos.find((p) => p.atrasado) ??
    PRIORIDADE.map((s) => periodos.find((p) => p.situacao === s)).find(Boolean);
  return {
    situacao: escolhido?.situacao ?? 'PENDENTE_ENVIO',
    envioAtual: escolhido?.envioAtual ?? null,
    podeEnviar: periodos.some((p) => p.podeEnviar),
    atrasado: resumo.atrasados > 0,
    periodos: resumo,
  };
}

function situacoes(
  empresaId: string,
  tipos: TipoMock[],
  obraId: string | null,
): DocumentoSituacaoPortal[] {
  return tipos
    .map((tipo): DocumentoSituacaoPortal => {
      const tipoDocumento = {
        id: tipo.id,
        nome: tipo.nome,
        instrucoes: tipo.instrucoes,
        abrangencia: tipo.abrangencia,
        periodicidade: tipo.periodicidade,
      };
      if (tipo.periodicidade.unidade !== 'UNICA') {
        return { tipoDocumento, ...situacaoPeriodica(empresaId, tipo, obraId) };
      }
      const [atual] = enviosDoDocumento(empresaId, tipo.id, obraId);
      const situacao: SituacaoDocumento = atual ? atual.status : 'PENDENTE_ENVIO';
      return {
        tipoDocumento,
        situacao,
        envioAtual: atual ?? null,
        podeEnviar: pedeEnvio(situacao),
        atrasado: false,
        periodos: null,
      };
    })
    .sort(
      (a, b) =>
        Number(b.atrasado) - Number(a.atrasado) ||
        ORDEM[a.situacao] - ORDEM[b.situacao] ||
        a.tipoDocumento.nome.localeCompare(b.tipoDocumento.nome, 'pt-BR'),
    );
}

/** Documentos gerais: todo tipo `GERAL` ativo (data-model §5). */
export function documentosGerais(empresaId: string): DocumentoSituacaoPortal[] {
  return situacoes(
    empresaId,
    banco.tipos.filter((t) => t.abrangencia === 'GERAL' && t.ativo),
    null,
  );
}

/**
 * Obra no alcance do portal (research R8): obra ativa com vínculo ativo da empresa. Fora disso,
 * as rotas de obra respondem 404.
 */
export function obraDoPortal(empresaId: string, obraId: string): ObraMock | null {
  const obra = banco.obras.find((o) => o.id === obraId && o.ativa);
  if (!obra) return null;
  const vinculado = banco.vinculos.some(
    (v) => v.obraId === obraId && v.empresaId === empresaId && v.ativo,
  );
  return vinculado ? obra : null;
}

/** Tipos `POR_OBRA` ativos e marcados na obra. */
export function tiposDaObra(obraId: string): TipoMock[] {
  return banco.tipos.filter(
    (t) =>
      t.abrangencia === 'POR_OBRA' &&
      t.ativo &&
      banco.obraTipos.some((m) => m.obraId === obraId && m.tipoDocumentoId === t.id),
  );
}

/** Documentos exigidos da empresa na obra (vazio se a obra está fora do alcance). */
export function documentosDaObra(empresaId: string, obraId: string): DocumentoSituacaoPortal[] {
  if (!obraDoPortal(empresaId, obraId)) return [];
  return situacoes(empresaId, tiposDaObra(obraId), obraId);
}

export function contagem(documentos: DocumentoSituacaoPortal[]): ContagemDocumentos {
  const n = (s: SituacaoDocumento) => documentos.filter((d) => d.situacao === s).length;
  return {
    total: documentos.length,
    pendentes: n('PENDENTE_ENVIO'),
    emAnalise: n('EM_ANALISE'),
    aprovados: n('APROVADO'),
    rejeitados: n('REJEITADO'),
    periodosAtrasados: documentos.reduce((soma, d) => soma + (d.periodos?.atrasados ?? 0), 0),
  };
}

/** `GET /api/portal/obras`: obras ativas com vínculo ativo; com pendência primeiro, depois nome. */
export function obrasDaEmpresa(empresaId: string): ObraPortal[] {
  return banco.obras
    .filter((o) => obraDoPortal(empresaId, o.id))
    .map(
      (o): ObraPortal => ({
        id: o.id,
        nome: o.nome,
        cidade: o.cidade,
        uf: o.uf,
        documentos: contagem(documentosDaObra(empresaId, o.id)),
      }),
    )
    .sort((a, b) => {
      const pendencia = (o: ObraPortal) =>
        o.documentos.pendentes + o.documentos.rejeitados + o.documentos.periodosAtrasados > 0
          ? 0
          : 1;
      return pendencia(a) - pendencia(b) || a.nome.localeCompare(b.nome, 'pt-BR');
    });
}

/** Detecta o formato pela assinatura de bytes (research R6). */
export function detectarFormato(bytes: Uint8Array): FormatoArquivo | null {
  const comeca = (assinatura: number[]) => assinatura.every((b, i) => bytes[i] === b);
  if (comeca([0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  if (comeca([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (comeca([0xff, 0xd8, 0xff])) return 'image/jpeg';
  return null;
}
