/**
 * Banco em memória dos mocks MSW. As estruturas internas seguem `data-model.md`; os handlers só
 * devolvem objetos no formato dos schemas de `contracts/openapi.yaml` (funções `para*` abaixo).
 * `reiniciarDados()` restaura a semente (usado entre testes).
 */
import type {
  Abrangencia,
  AutorFluig,
  ContagemDocumentos,
  Convite,
  DocumentoSituacao,
  Empresa,
  EmpresaNaObra,
  EmpresaResumo,
  Envio,
  EnvioFila,
  FormatoArquivo,
  Obra,
  ObraNaEmpresa,
  ObraRef,
  SituacaoAcesso,
  SituacaoConvite,
  SituacaoDocumento,
  StatusEnvio,
  TipoDocumento,
  TipoDocumentoRef,
  TipoExigidoObra,
  VinculoEncerrado,
  OrigemSessao,
  Periodicidade,
  Periodo,
  ResumoPeriodos,
  SituacaoUsuarioInterno,
  Uf,
  UsuarioFluig,
  UsuarioInterno,
} from '../api/tipos';
import { descreverPeriodicidade } from '../utils/periodicidade';
import { dataLocal, gerarPeriodos, rotuloPeriodo, somarDias, somarMeses, type PeriodoCalculado } from './periodos';

export interface ObraDb {
  id: string;
  nome: string;
  codigo: string | null;
  cidade: string;
  uf: Uf;
  ativa: boolean;
  criadoEm: string;
}

export interface EmpresaDb {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  emailContato: string;
  nomeContato: string | null;
  telefone: string | null;
  ativa: boolean;
  criadoEm: string;
  trocaSenhaObrigatoria: boolean;
  senhaTemporariaExpiraEm: string | null;
  ultimoAcessoEm: string | null;
}

/** Vínculo obra–empresa (002, data-model §3): desvincular encerra em vez de apagar. */
export interface VinculoDb {
  obraId: string;
  empresaId: string;
  vinculadoEm: string;
  ativo: boolean;
  encerradoEm: string | null;
  encerradoPorLogin: string | null;
}

export interface TipoDb {
  id: string;
  nome: string;
  instrucoes: string | null;
  abrangencia: Abrangencia;
  /** 003: só os campos de entrada (`descricao` é montada na resposta). */
  periodicidade: Periodicidade;
  ativo: boolean;
  criadoEm: string;
  /** 003 (data-model §1): = criação; = agora ao reativar ou ao passar de única para periódico. */
  cobrancaDesde: string;
}

/** Tipo `POR_OBRA` marcado como exigido numa obra (002, data-model §2). */
export interface ObraTipoDb {
  obraId: string;
  tipoDocumentoId: string;
  marcadoEm: string;
  marcadoPorLogin: string;
}

export interface ConviteDb {
  id: string;
  empresaId: string;
  emailDestino: string;
  enviadoEm: string;
  expiraEm: string;
  usadoEm: string | null;
  substituidoEm: string | null;
  enviadoPor: AutorFluig;
}

export interface EnvioDb {
  id: string;
  empresaId: string;
  tipoDocumentoId: string;
  /** null = documento geral; obrigatório para tipo `POR_OBRA` (002, data-model §4). */
  obraId: string | null;
  nomeArquivo: string;
  formato: FormatoArquivo;
  tamanhoBytes: number;
  enviadoEm: string;
  status: StatusEnvio;
  analisadoEm: string | null;
  analisadoPor: AutorFluig | null;
  motivoRejeicao: string | null;
  /** 003: período do envio (`AAAA-MM-DD`); null ⇔ tipo de periodicidade UNICA. */
  periodoInicio: string | null;
  periodoFim: string | null;
  enviadoComAtraso: boolean;
}

/** Usuário administrador dos mocks (token Fluig com `roles: ["admin"]`). */
export const USUARIO_MOCK: UsuarioFluig = {
  login: 'dev.analista',
  nome: 'Analista Dev',
  email: 'analista@jotanunes.com',
  admin: true,
  origem: 'FLUIG',
  trocaSenhaObrigatoria: false,
};

/** Usuário comum dos mocks (token Fluig sem `roles`): consulta e convida, não cadastra nem analisa. */
export const USUARIO_MOCK_COMUM: UsuarioFluig = {
  login: 'joao.comum',
  nome: 'João Comum',
  email: 'joao.comum@jotanunes.com',
  admin: false,
  origem: 'FLUIG',
  trocaSenhaObrigatoria: false,
};

// ───────────────────────────── Sessão do mock (R16/R17) ─────────────────────────────

export type PerfilMock = 'admin' | 'comum';

/**
 * O que um token "genérico" do mock (qualquer token que não seja do login próprio, ex.:
 * `token-de-teste`, `token-dev-mocks`) representa. Padrão: administrador entrando pelo Fluig.
 * Com `origem: 'LOGIN_LOCAL'` o token genérico vira a sessão de `admin.mock` (ou `comum.mock`).
 * Os tokens emitidos pelo login do mock (`local:<id>:<versão>`) não dependem disto: valem enquanto o
 * usuário interno estiver ativo e com a mesma versão de credencial (revogação, R17).
 */
export interface SessaoMock {
  perfil: PerfilMock;
  origem: OrigemSessao;
  trocaSenhaObrigatoria: boolean;
}

/** `VITE_MOCK_PERFIL=comum` simula o usuário comum no `npm run dev`; qualquer outro valor = admin. */
function perfilDoAmbiente(): PerfilMock {
  return import.meta.env.VITE_MOCK_PERFIL === 'comum' ? 'comum' : 'admin';
}

const SESSAO_PADRAO: SessaoMock = { perfil: 'admin', origem: 'FLUIG', trocaSenhaObrigatoria: false };

let sessaoAtual: SessaoMock = { ...SESSAO_PADRAO, perfil: perfilDoAmbiente() };
let loginLocalHabilitado = true;

/** Troca o perfil do usuário simulado (testes). O `setup.ts` volta para `admin` depois de cada teste. */
export function definirPerfilMock(perfil: PerfilMock): void {
  sessaoAtual = { ...sessaoAtual, perfil };
}

export function perfilMock(): PerfilMock {
  return sessaoAtual.perfil;
}

/** Ajusta a sessão do token genérico (testes). O `setup.ts` volta ao padrão (admin, Fluig). */
export function definirSessaoMock(parcial: Partial<SessaoMock>): void {
  sessaoAtual = { ...sessaoAtual, ...parcial };
}

export function reiniciarSessaoMock(): void {
  sessaoAtual = { ...SESSAO_PADRAO };
  loginLocalHabilitado = true;
}

/** `GET /api/fluig/auth/configuracao` do mock (`Auth:LoginLocal:Habilitado`). Padrão: ligado. */
export function definirLoginLocalMock(habilitado: boolean): void {
  loginLocalHabilitado = habilitado;
}

export function loginLocalMock(): boolean {
  return loginLocalHabilitado;
}

/** Usuário interno que o token genérico representa quando `origem = LOGIN_LOCAL`. */
function internoDaSessaoGenerica(): UsuarioInternoDb | undefined {
  const login = sessaoAtual.perfil === 'comum' ? 'comum.mock' : 'admin.mock';
  return db.usuarios.find((u) => u.login === login);
}

/** Usuário que o mock de `/api/fluig/me` devolve para o token genérico. */
export function usuarioMock(): UsuarioFluig {
  if (sessaoAtual.origem === 'LOGIN_LOCAL') {
    const interno = internoDaSessaoGenerica();
    if (interno) {
      return {
        ...paraUsuarioFluig(interno),
        trocaSenhaObrigatoria: sessaoAtual.trocaSenhaObrigatoria,
      };
    }
  }
  const base = sessaoAtual.perfil === 'comum' ? USUARIO_MOCK_COMUM : USUARIO_MOCK;
  return { ...base, origem: sessaoAtual.origem, trocaSenhaObrigatoria: false };
}

/** Sessão resolvida de uma requisição: o usuário e, no login próprio, o id do usuário interno. */
export interface SessaoResolvida {
  usuario: UsuarioFluig;
  usuarioInternoId: string | null;
}

const PREFIXO_TOKEN_LOCAL = 'local:';

/** Token do login próprio no mock: `local:<id>:<versão da credencial>` (o `ver` do JWT real). */
export function tokenLocal(u: UsuarioInternoDb): string {
  return `${PREFIXO_TOKEN_LOCAL}${u.id}:${u.versao}`;
}

/**
 * Esquema fluigAuth simulado. `null` = 401. Tokens `invalido`, `expirado` e `portal:*` são
 * recusados; `local:*` é conferido no "banco" (ativo, mesma versão); os demais são o token genérico.
 */
export function resolverSessao(token: string | null | undefined): SessaoResolvida | null {
  if (!token || token === 'invalido' || token === 'expirado' || token.startsWith('portal:')) return null;
  if (token.startsWith(PREFIXO_TOKEN_LOCAL)) {
    const [id, versao] = token.slice(PREFIXO_TOKEN_LOCAL.length).split(':');
    const u = db.usuarios.find((x) => x.id === id);
    if (!u || !u.ativo || String(u.versao) !== versao || !loginLocalHabilitado) return null;
    return { usuario: paraUsuarioFluig(u), usuarioInternoId: u.id };
  }
  const usuario = usuarioMock();
  const interno = usuario.origem === 'LOGIN_LOCAL' ? internoDaSessaoGenerica() : undefined;
  return { usuario, usuarioInternoId: interno?.id ?? null };
}

// ───────────────────────────── Usuários internos (data-model §10) ─────────────────────────────

export interface UsuarioInternoDb {
  id: string;
  login: string;
  nome: string;
  email: string;
  admin: boolean;
  ativo: boolean;
  /** Mock: senha em texto (a API guarda só o hash BCrypt). */
  senha: string;
  trocaSenhaObrigatoria: boolean;
  senhaProvisoriaExpiraEm: string | null;
  versao: number;
  tentativasFalhas: number;
  bloqueadoAte: string | null;
  ultimoAcessoEm: string | null;
  criadoEm: string;
  criadoPor: string;
  atualizadoEm: string | null;
}

/** Senha provisória fixa do mock (a API gera 12 caracteres aleatórios e manda por e-mail). */
export const SENHA_PROVISORIA_MOCK = 'Temp1234';

/** Tentativas de login inexistente (tabela `tentativas_login` da API). */
export const tentativasLoginInexistente = new Map<string, { falhas: number; bloqueadoAte: string | null }>();

const UNICA: Periodicidade = { unidade: 'UNICA', intervalo: null, prazoDias: null };

const OUTRA_ANALISTA: AutorFluig = { login: 'maria.silva', nome: 'Maria Silva' };

export const db = {
  obras: [] as ObraDb[],
  empresas: [] as EmpresaDb[],
  vinculos: [] as VinculoDb[],
  tipos: [] as TipoDb[],
  obraTipos: [] as ObraTipoDb[],
  convites: [] as ConviteDb[],
  envios: [] as EnvioDb[],
  usuarios: [] as UsuarioInternoDb[],
};

let sequencia = 0;
/** UUID v4 determinístico o bastante para os mocks. */
export function novoId(): string {
  sequencia += 1;
  const hex = sequencia.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

/**
 * Data fixa dos testes de períodos (003): 26/10/2026, 12h em Brasília. Com o relógio fixo, a
 * semente é recalculada a partir dela e os rótulos ("Setembro/2026") ficam estáveis.
 */
export const DATA_FIXA_TESTES = '2026-10-26T15:00:00.000Z';

let relogioFixo: Date | null = null;

/** Fixa (ou solta, com `null`) o relógio do mock. Chame `reiniciarDados()` depois para recalcular a semente. */
export function fixarRelogioMock(instante: string | Date | null): void {
  relogioFixo = instante ? new Date(instante) : null;
}

export function agora(): Date {
  return relogioFixo ? new Date(relogioFixo) : new Date();
}

/** Hoje (`AAAA-MM-DD`) no fuso de Brasília. */
export function hojeLocal(): string {
  return dataLocal(agora());
}

/** Meio-dia de Brasília da data (`AAAA-MM-DD`) como ISO. */
function meioDia(data: string): string {
  return `${data}T15:00:00.000Z`;
}

export function agoraIso(): string {
  return agora().toISOString();
}

function ha(dias: number, horas = 0): string {
  return new Date(agora().getTime() - (dias * 24 + horas) * 3_600_000).toISOString();
}

export function daqui(dias: number): string {
  return new Date(agora().getTime() + dias * 24 * 3_600_000).toISOString();
}

// ───────────────────────────── Semente ─────────────────────────────

export const IDS = {
  obraVistaDoRio: '11111111-1111-4111-8111-000000000001',
  obraFlorDeSal: '11111111-1111-4111-8111-000000000002',
  obraPalmeiras: '11111111-1111-4111-8111-000000000003',
  tipoAso: '22222222-2222-4222-8222-000000000001',
  tipoCartaoCnpj: '22222222-2222-4222-8222-000000000002',
  tipoCndFederal: '22222222-2222-4222-8222-000000000003',
  tipoPcmso: '22222222-2222-4222-8222-000000000004',
  tipoAlvara: '22222222-2222-4222-8222-000000000005',
  tipoArt: '22222222-2222-4222-8222-000000000006',
  tipoOrdemServico: '22222222-2222-4222-8222-000000000007',
  tipoPgrCanteiro: '22222222-2222-4222-8222-000000000008',
  tipoGuiaFgts: '22222222-2222-4222-8222-000000000009',
  tipoRelatorioTrimestral: '22222222-2222-4222-8222-000000000010',
  empresaAlfa: '33333333-3333-4333-8333-000000000001',
  empresaBeta: '33333333-3333-4333-8333-000000000002',
  empresaGama: '33333333-3333-4333-8333-000000000003',
  empresaDelta: '33333333-3333-4333-8333-000000000004',
  empresaEpsilon: '33333333-3333-4333-8333-000000000005',
  empresaZeta: '33333333-3333-4333-8333-000000000006',
  envioAlfaCnpj: '44444444-4444-4444-8444-000000000001',
  envioAlfaCndRejeitado: '44444444-4444-4444-8444-000000000002',
  envioAlfaPcmso: '44444444-4444-4444-8444-000000000003',
  envioZetaAso: '44444444-4444-4444-8444-000000000004',
  envioZetaCnpj: '44444444-4444-4444-8444-000000000005',
  envioAlfaAso: '44444444-4444-4444-8444-000000000006',
  envioAlfaAlvaraRejeitado: '44444444-4444-4444-8444-000000000007',
  envioAlfaAlvaraAprovado: '44444444-4444-4444-8444-000000000008',
  envioAlfaArtVistaDoRio: '44444444-4444-4444-8444-000000000009',
  envioAlfaArtFlorDeSal: '44444444-4444-4444-8444-000000000010',
  envioZetaOrdemRejeitado: '44444444-4444-4444-8444-000000000011',
  envioGamaArtEncerrado: '44444444-4444-4444-8444-000000000012',
  envioAlfaFgtsAprovado: '44444444-4444-4444-8444-000000000013',
  envioAlfaFgtsAtrasado: '44444444-4444-4444-8444-000000000014',
  envioZetaFgts: '44444444-4444-4444-8444-000000000015',
  envioAlfaTrimestral: '44444444-4444-4444-8444-000000000016',
  usuarioAdmin: '55555555-5555-4555-8555-000000000001',
  usuarioComum: '55555555-5555-4555-8555-000000000002',
  usuarioNovo: '55555555-5555-4555-8555-000000000003',
  usuarioInativo: '55555555-5555-4555-8555-000000000004',
  usuarioExpirado: '55555555-5555-4555-8555-000000000005',
} as const;

function semear(): void {
  sequencia = 0;
  db.obras.splice(0, db.obras.length, ...[
    { id: IDS.obraVistaDoRio, nome: 'Residencial Vista do Rio', codigo: 'VDR-01', cidade: 'Aracaju', uf: 'SE' as Uf, ativa: true, criadoEm: ha(60) },
    { id: IDS.obraFlorDeSal, nome: 'Condomínio Flor de Sal', codigo: 'FDS-02', cidade: 'Aracaju', uf: 'SE' as Uf, ativa: true, criadoEm: ha(45) },
    { id: IDS.obraPalmeiras, nome: 'Parque das Palmeiras', codigo: null, cidade: 'Maceió', uf: 'AL' as Uf, ativa: false, criadoEm: ha(300) },
  ]);

  const G = 'GERAL' as Abrangencia;
  const PO = 'POR_OBRA' as Abrangencia;
  const tiposUnicos: Omit<TipoDb, 'periodicidade' | 'cobrancaDesde'>[] = [
    { id: IDS.tipoAso, nome: 'ASO — Atestado de Saúde Ocupacional', instrucoes: 'Envie o ASO admissional de cada trabalhador que vai atuar na obra, assinado pelo médico do trabalho.', abrangencia: G, ativo: true, criadoEm: ha(90) },
    { id: IDS.tipoCartaoCnpj, nome: 'Cartão CNPJ', instrucoes: 'Comprovante de inscrição emitido no site da Receita Federal há no máximo 30 dias.', abrangencia: G, ativo: true, criadoEm: ha(90) },
    { id: IDS.tipoCndFederal, nome: 'CND Federal', instrucoes: 'Certidão negativa (ou positiva com efeito de negativa) de débitos federais, dentro da validade.', abrangencia: G, ativo: true, criadoEm: ha(90) },
    { id: IDS.tipoPcmso, nome: 'PCMSO', instrucoes: null, abrangencia: G, ativo: true, criadoEm: ha(80) },
    { id: IDS.tipoAlvara, nome: 'Alvará de funcionamento (antigo)', instrucoes: 'Não é mais exigido.', abrangencia: G, ativo: false, criadoEm: ha(200) },
    { id: IDS.tipoArt, nome: 'ART da obra', instrucoes: 'ART do serviço nesta obra, assinada pelo responsável técnico.', abrangencia: PO, ativo: true, criadoEm: ha(10) },
    { id: IDS.tipoOrdemServico, nome: 'Ordem de serviço', instrucoes: 'Ordem de serviço assinada para esta obra.', abrangencia: PO, ativo: true, criadoEm: ha(10) },
    { id: IDS.tipoPgrCanteiro, nome: 'PGR do canteiro', instrucoes: null, abrangencia: PO, ativo: true, criadoEm: ha(9) },
  ];
  // 003: geral mensal cobrado desde 3 meses antes de hoje; por obra a cada 3 meses.
  const fgtsDesde = meioDia(somarMeses(hojeLocal(), -3));
  db.tipos.splice(0, db.tipos.length, ...[
    ...tiposUnicos.map((t) => ({ ...t, periodicidade: UNICA, cobrancaDesde: t.criadoEm })),
    { id: IDS.tipoGuiaFgts, nome: 'Guia do FGTS', instrucoes: 'Guia de recolhimento do FGTS do mês, com o comprovante de pagamento.', abrangencia: G, periodicidade: { unidade: 'MESES', intervalo: 1, prazoDias: 15 } as Periodicidade, ativo: true, criadoEm: fgtsDesde, cobrancaDesde: fgtsDesde },
    { id: IDS.tipoRelatorioTrimestral, nome: 'Relatório trimestral', instrucoes: 'Relatório de atividades do trimestre nesta obra.', abrangencia: PO, periodicidade: { unidade: 'MESES', intervalo: 3, prazoDias: 10 } as Periodicidade, ativo: true, criadoEm: ha(120), cobrancaDesde: ha(120) },
  ]);

  db.empresas.splice(0, db.empresas.length, ...[
    { id: IDS.empresaAlfa, razaoSocial: 'Alfa Engenharia Ltda', nomeFantasia: 'Alfa Engenharia', cnpj: '11222333000181', emailContato: 'contato@alfa.test', nomeContato: 'Carlos Menezes', telefone: '79999991234', ativa: true, criadoEm: ha(130), trocaSenhaObrigatoria: false, senhaTemporariaExpiraEm: null, ultimoAcessoEm: ha(1, 3) },
    { id: IDS.empresaBeta, razaoSocial: 'Beta Serviços de Montagem S.A.', nomeFantasia: 'Beta Serviços', cnpj: '12ABC34501DE35', emailContato: 'contato@beta.test', nomeContato: null, telefone: null, ativa: true, criadoEm: ha(20), trocaSenhaObrigatoria: true, senhaTemporariaExpiraEm: daqui(5), ultimoAcessoEm: null },
    { id: IDS.empresaGama, razaoSocial: 'Gama Instalações Elétricas Ltda', nomeFantasia: null, cnpj: '12345678000195', emailContato: 'financeiro@gama.test', nomeContato: 'Rita Souza', telefone: '7932221234', ativa: true, criadoEm: ha(3), trocaSenhaObrigatoria: false, senhaTemporariaExpiraEm: null, ultimoAcessoEm: null },
    { id: IDS.empresaDelta, razaoSocial: 'Delta Pinturas e Acabamentos ME', nomeFantasia: 'Delta Pinturas', cnpj: '33445566000186', emailContato: 'delta@delta.test', nomeContato: null, telefone: null, ativa: true, criadoEm: ha(30), trocaSenhaObrigatoria: true, senhaTemporariaExpiraEm: ha(2), ultimoAcessoEm: null },
    { id: IDS.empresaEpsilon, razaoSocial: 'Épsilon Terraplenagem Ltda', nomeFantasia: null, cnpj: '99887766000105', emailContato: 'contato@epsilon.test', nomeContato: null, telefone: null, ativa: false, criadoEm: ha(120), trocaSenhaObrigatoria: false, senhaTemporariaExpiraEm: null, ultimoAcessoEm: ha(100) },
    { id: IDS.empresaZeta, razaoSocial: 'Zeta Andaimes e Equipamentos Ltda', nomeFantasia: 'Zeta Andaimes', cnpj: '44556677000186', emailContato: 'docs@zeta.test', nomeContato: 'Paulo Lima', telefone: '79988887777', ativa: true, criadoEm: ha(25), trocaSenhaObrigatoria: false, senhaTemporariaExpiraEm: null, ultimoAcessoEm: ha(0, 5) },
  ]);

  const ativo = { ativo: true, encerradoEm: null, encerradoPorLogin: null };
  db.vinculos.splice(0, db.vinculos.length, ...[
    { obraId: IDS.obraVistaDoRio, empresaId: IDS.empresaAlfa, vinculadoEm: ha(39), ...ativo },
    { obraId: IDS.obraVistaDoRio, empresaId: IDS.empresaBeta, vinculadoEm: ha(19), ...ativo },
    { obraId: IDS.obraVistaDoRio, empresaId: IDS.empresaZeta, vinculadoEm: ha(24), ...ativo },
    { obraId: IDS.obraFlorDeSal, empresaId: IDS.empresaAlfa, vinculadoEm: ha(30), ...ativo },
    { obraId: IDS.obraFlorDeSal, empresaId: IDS.empresaDelta, vinculadoEm: ha(29), ...ativo },
    { obraId: IDS.obraPalmeiras, empresaId: IDS.empresaEpsilon, vinculadoEm: ha(290), ...ativo },
    // Vínculo encerrado com histórico (US5).
    { obraId: IDS.obraVistaDoRio, empresaId: IDS.empresaGama, vinculadoEm: ha(3), ativo: false, encerradoEm: ha(1), encerradoPorLogin: OUTRA_ANALISTA.login },
  ]);

  // Tipos exigidos por obra: Vista do Rio exige ART e ordem de serviço; Flor de Sal só ART.
  db.obraTipos.splice(0, db.obraTipos.length, ...[
    { obraId: IDS.obraVistaDoRio, tipoDocumentoId: IDS.tipoArt, marcadoEm: ha(9), marcadoPorLogin: OUTRA_ANALISTA.login },
    { obraId: IDS.obraVistaDoRio, tipoDocumentoId: IDS.tipoOrdemServico, marcadoEm: ha(9), marcadoPorLogin: OUTRA_ANALISTA.login },
    { obraId: IDS.obraFlorDeSal, tipoDocumentoId: IDS.tipoArt, marcadoEm: ha(8), marcadoPorLogin: OUTRA_ANALISTA.login },
    { obraId: IDS.obraVistaDoRio, tipoDocumentoId: IDS.tipoRelatorioTrimestral, marcadoEm: ha(100), marcadoPorLogin: OUTRA_ANALISTA.login },
  ]);

  const analista: AutorFluig = { login: USUARIO_MOCK.login, nome: USUARIO_MOCK.nome };
  db.convites.splice(0, db.convites.length, ...[
    { id: novoId(), empresaId: IDS.empresaAlfa, emailDestino: 'contato@alfa.test', enviadoEm: ha(38), expiraEm: ha(31), usadoEm: ha(37), substituidoEm: null, enviadoPor: OUTRA_ANALISTA },
    { id: novoId(), empresaId: IDS.empresaBeta, emailDestino: 'contato@beta.test', enviadoEm: ha(9), expiraEm: ha(2), usadoEm: null, substituidoEm: ha(2), enviadoPor: analista },
    { id: novoId(), empresaId: IDS.empresaBeta, emailDestino: 'contato@beta.test', enviadoEm: ha(2), expiraEm: daqui(5), usadoEm: null, substituidoEm: null, enviadoPor: analista },
    { id: novoId(), empresaId: IDS.empresaDelta, emailDestino: 'delta@delta.test', enviadoEm: ha(9), expiraEm: ha(2), usadoEm: null, substituidoEm: null, enviadoPor: OUTRA_ANALISTA },
    { id: novoId(), empresaId: IDS.empresaEpsilon, emailDestino: 'contato@epsilon.test', enviadoEm: ha(110), expiraEm: ha(103), usadoEm: ha(109), substituidoEm: null, enviadoPor: OUTRA_ANALISTA },
    { id: novoId(), empresaId: IDS.empresaZeta, emailDestino: 'docs@zeta.test', enviadoEm: ha(24), expiraEm: ha(17), usadoEm: ha(23), substituidoEm: null, enviadoPor: analista },
  ]);

  const enviosUnicos: Omit<EnvioDb, 'periodoInicio' | 'periodoFim' | 'enviadoComAtraso'>[] = [
    { id: IDS.envioAlfaCnpj, empresaId: IDS.empresaAlfa, tipoDocumentoId: IDS.tipoCartaoCnpj, obraId: null, nomeArquivo: 'cartao-cnpj-alfa.pdf', formato: 'application/pdf' as FormatoArquivo, tamanhoBytes: 184_320, enviadoEm: ha(12), status: 'APROVADO' as StatusEnvio, analisadoEm: ha(11), analisadoPor: OUTRA_ANALISTA, motivoRejeicao: null },
    { id: IDS.envioAlfaCndRejeitado, empresaId: IDS.empresaAlfa, tipoDocumentoId: IDS.tipoCndFederal, obraId: null, nomeArquivo: 'cnd-federal.jpg', formato: 'image/jpeg' as FormatoArquivo, tamanhoBytes: 1_572_864, enviadoEm: ha(10), status: 'REJEITADO' as StatusEnvio, analisadoEm: ha(9), analisadoPor: analista, motivoRejeicao: 'Documento ilegível, envie de novo em PDF.' },
    { id: IDS.envioAlfaPcmso, empresaId: IDS.empresaAlfa, tipoDocumentoId: IDS.tipoPcmso, obraId: null, nomeArquivo: 'PCMSO 2026 - Alfa Engenharia.pdf', formato: 'application/pdf' as FormatoArquivo, tamanhoBytes: 2_411_724, enviadoEm: ha(3, 6), status: 'EM_ANALISE' as StatusEnvio, analisadoEm: null, analisadoPor: null, motivoRejeicao: null },
    { id: IDS.envioZetaAso, empresaId: IDS.empresaZeta, tipoDocumentoId: IDS.tipoAso, obraId: null, nomeArquivo: 'aso-equipe-zeta.pdf', formato: 'application/pdf' as FormatoArquivo, tamanhoBytes: 734_003, enviadoEm: ha(2, 2), status: 'EM_ANALISE' as StatusEnvio, analisadoEm: null, analisadoPor: null, motivoRejeicao: null },
    { id: IDS.envioZetaCnpj, empresaId: IDS.empresaZeta, tipoDocumentoId: IDS.tipoCartaoCnpj, obraId: null, nomeArquivo: 'cartao_cnpj.png', formato: 'image/png' as FormatoArquivo, tamanhoBytes: 402_115, enviadoEm: ha(0, 4), status: 'EM_ANALISE' as StatusEnvio, analisadoEm: null, analisadoPor: null, motivoRejeicao: null },
    // Envios de um tipo desativado depois (continuam no histórico — Edge Case da spec, T120).
    { id: IDS.envioAlfaAlvaraRejeitado, empresaId: IDS.empresaAlfa, tipoDocumentoId: IDS.tipoAlvara, obraId: null, nomeArquivo: 'alvara-2025.jpg', formato: 'image/jpeg' as FormatoArquivo, tamanhoBytes: 655_360, enviadoEm: ha(35), status: 'REJEITADO' as StatusEnvio, analisadoEm: ha(34), analisadoPor: OUTRA_ANALISTA, motivoRejeicao: 'Alvará vencido.' },
    { id: IDS.envioAlfaAlvaraAprovado, empresaId: IDS.empresaAlfa, tipoDocumentoId: IDS.tipoAlvara, obraId: null, nomeArquivo: 'alvara-2026.pdf', formato: 'application/pdf' as FormatoArquivo, tamanhoBytes: 212_992, enviadoEm: ha(33), status: 'APROVADO' as StatusEnvio, analisadoEm: ha(32), analisadoPor: analista, motivoRejeicao: null },
    { id: IDS.envioAlfaAso, empresaId: IDS.empresaAlfa, tipoDocumentoId: IDS.tipoAso, obraId: null, nomeArquivo: 'aso-alfa.pdf', formato: 'application/pdf' as FormatoArquivo, tamanhoBytes: 98_304, enviadoEm: ha(8), status: 'APROVADO' as StatusEnvio, analisadoEm: ha(7), analisadoPor: analista, motivoRejeicao: null },
    // Envios por obra (002): mesmo tipo em obras diferentes tem situação independente.
    { id: IDS.envioAlfaArtVistaDoRio, empresaId: IDS.empresaAlfa, tipoDocumentoId: IDS.tipoArt, obraId: IDS.obraVistaDoRio, nomeArquivo: 'art-vista-do-rio.pdf', formato: 'application/pdf' as FormatoArquivo, tamanhoBytes: 120_000, enviadoEm: ha(6), status: 'APROVADO' as StatusEnvio, analisadoEm: ha(5), analisadoPor: analista, motivoRejeicao: null },
    { id: IDS.envioAlfaArtFlorDeSal, empresaId: IDS.empresaAlfa, tipoDocumentoId: IDS.tipoArt, obraId: IDS.obraFlorDeSal, nomeArquivo: 'art-flor-de-sal.pdf', formato: 'application/pdf' as FormatoArquivo, tamanhoBytes: 130_000, enviadoEm: ha(1, 2), status: 'EM_ANALISE' as StatusEnvio, analisadoEm: null, analisadoPor: null, motivoRejeicao: null },
    { id: IDS.envioZetaOrdemRejeitado, empresaId: IDS.empresaZeta, tipoDocumentoId: IDS.tipoOrdemServico, obraId: IDS.obraVistaDoRio, nomeArquivo: 'os-zeta.pdf', formato: 'application/pdf' as FormatoArquivo, tamanhoBytes: 90_000, enviadoEm: ha(4), status: 'REJEITADO' as StatusEnvio, analisadoEm: ha(3), analisadoPor: OUTRA_ANALISTA, motivoRejeicao: 'Falta a assinatura do responsável.' },
    { id: IDS.envioGamaArtEncerrado, empresaId: IDS.empresaGama, tipoDocumentoId: IDS.tipoArt, obraId: IDS.obraVistaDoRio, nomeArquivo: 'art-gama.pdf', formato: 'application/pdf' as FormatoArquivo, tamanhoBytes: 80_000, enviadoEm: ha(2, 5), status: 'APROVADO' as StatusEnvio, analisadoEm: ha(2), analisadoPor: analista, motivoRejeicao: null },
  ];
  db.envios.splice(0, db.envios.length, ...enviosUnicos.map((e) => ({ ...e, periodoInicio: null, periodoFim: null, enviadoComAtraso: false })));
  semearEnviosPeriodicos(analista);
}

/**
 * Envios dos tipos periódicos, calculados sobre os períodos de hoje (com `DATA_FIXA_TESTES`:
 * Alfa — Julho/2026 aprovado, Agosto/2026 em análise enviado com atraso, Setembro/2026 atrasado,
 * Outubro/2026 pendente; Zeta — Outubro/2026 em análise; Alfa no Vista do Rio — trimestre atual aprovado).
 */
function semearEnviosPeriodicos(analista: AutorFluig): void {
  const fgts = db.tipos.find((t) => t.id === IDS.tipoGuiaFgts)!;
  const trimestral = db.tipos.find((t) => t.id === IDS.tipoRelatorioTrimestral)!;
  const base = { formato: 'application/pdf' as FormatoArquivo, analisadoEm: null, analisadoPor: null, motivoRejeicao: null };
  const umMinutoAtras = new Date(agora().getTime() - 60_000).toISOString();

  const alfa = periodosCalculados(IDS.empresaAlfa, fgts, null);
  if (alfa.length >= 3) {
    const [p0, p1] = alfa;
    const aprovadoEm = meioDia(somarDias(p0.fim, 5));
    db.envios.push(
      { ...base, ...envioDoPeriodo(p0, aprovadoEm), id: IDS.envioAlfaFgtsAprovado, empresaId: IDS.empresaAlfa, tipoDocumentoId: fgts.id, obraId: null, nomeArquivo: `fgts-${p0.inicio.slice(0, 7)}.pdf`, tamanhoBytes: 150_000, status: 'APROVADO' as StatusEnvio, analisadoEm: meioDia(somarDias(p0.fim, 6)), analisadoPor: analista },
      { ...base, ...envioDoPeriodo(p1, meioDia(somarDias(p1.fim, 25))), id: IDS.envioAlfaFgtsAtrasado, empresaId: IDS.empresaAlfa, tipoDocumentoId: fgts.id, obraId: null, nomeArquivo: `fgts-${p1.inicio.slice(0, 7)}.pdf`, tamanhoBytes: 160_000, status: 'EM_ANALISE' as StatusEnvio },
    );
  }
  const zeta = periodosCalculados(IDS.empresaZeta, fgts, null).at(-1);
  if (zeta) {
    db.envios.push({ ...base, ...envioDoPeriodo(zeta, umMinutoAtras), id: IDS.envioZetaFgts, empresaId: IDS.empresaZeta, tipoDocumentoId: fgts.id, obraId: null, nomeArquivo: 'guia-fgts-zeta.pdf', tamanhoBytes: 140_000, status: 'EM_ANALISE' as StatusEnvio });
  }
  const tri = periodosCalculados(IDS.empresaAlfa, trimestral, IDS.obraVistaDoRio).at(-1);
  if (tri) {
    db.envios.push({ ...base, ...envioDoPeriodo(tri, umMinutoAtras), id: IDS.envioAlfaTrimestral, empresaId: IDS.empresaAlfa, tipoDocumentoId: trimestral.id, obraId: IDS.obraVistaDoRio, nomeArquivo: 'relatorio-trimestral-alfa.pdf', tamanhoBytes: 300_000, status: 'APROVADO' as StatusEnvio, analisadoEm: umMinutoAtras, analisadoPor: OUTRA_ANALISTA });
  }
}

/** Campos de período de um envio feito em `enviadoEm` (com atraso = depois do prazo). */
export function envioDoPeriodo(p: PeriodoCalculado, enviadoEm: string) {
  return { enviadoEm, periodoInicio: p.inicio, periodoFim: p.fim, enviadoComAtraso: dataLocal(enviadoEm) > p.prazo };
}

function semearUsuarios(): void {
  const base = { tentativasFalhas: 0, bloqueadoAte: null, criadoPor: 'sistema', atualizadoEm: null };
  db.usuarios.splice(0, db.usuarios.length, ...[
    { ...base, id: IDS.usuarioAdmin, login: 'admin.mock', nome: 'Ana Administradora', email: 'ana.admin@jotanunes.com', admin: true, ativo: true, senha: 'Admin1234', trocaSenhaObrigatoria: false, senhaProvisoriaExpiraEm: null, versao: 0, ultimoAcessoEm: ha(0, 2), criadoEm: ha(30) },
    { ...base, id: IDS.usuarioComum, login: 'comum.mock', nome: 'Carlos Comum', email: 'carlos.comum@jotanunes.com', admin: false, ativo: true, senha: 'Comum1234', trocaSenhaObrigatoria: false, senhaProvisoriaExpiraEm: null, versao: 0, ultimoAcessoEm: ha(1, 4), criadoEm: ha(20), criadoPor: 'admin.mock' },
    { ...base, id: IDS.usuarioNovo, login: 'novo.mock', nome: 'Nina Nova', email: 'nina.nova@jotanunes.com', admin: false, ativo: true, senha: SENHA_PROVISORIA_MOCK, trocaSenhaObrigatoria: true, senhaProvisoriaExpiraEm: daqui(6), versao: 0, ultimoAcessoEm: null, criadoEm: ha(1), criadoPor: 'admin.mock' },
    { ...base, id: IDS.usuarioInativo, login: 'inativo.mock', nome: 'Igor Inativo', email: 'igor.inativo@jotanunes.com', admin: false, ativo: false, senha: 'Inativo1234', trocaSenhaObrigatoria: false, senhaProvisoriaExpiraEm: null, versao: 1, ultimoAcessoEm: ha(40), criadoEm: ha(90), criadoPor: 'admin.mock', atualizadoEm: ha(35) },
    { ...base, id: IDS.usuarioExpirado, login: 'expirado.mock', nome: 'Eva Expirada', email: 'eva.expirada@jotanunes.com', admin: false, ativo: true, senha: SENHA_PROVISORIA_MOCK, trocaSenhaObrigatoria: true, senhaProvisoriaExpiraEm: ha(2), versao: 0, ultimoAcessoEm: null, criadoEm: ha(9), criadoPor: 'admin.mock' },
  ]);
  tentativasLoginInexistente.clear();
}

export function reiniciarDados(): void {
  semear();
  semearUsuarios();
}

// ───────────────────────────── Derivações (data-model.md) ─────────────────────────────

export function situacaoConvite(c: ConviteDb): SituacaoConvite {
  if (c.usadoEm) return 'USADO';
  if (c.substituidoEm) return 'SUBSTITUIDO';
  if (new Date(c.expiraEm).getTime() <= agora().getTime()) return 'EXPIRADO';
  return 'VALIDO';
}

export function convitesDaEmpresa(empresaId: string): ConviteDb[] {
  return db.convites
    .filter((c) => c.empresaId === empresaId)
    .sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm));
}

export function situacaoAcesso(e: EmpresaDb): SituacaoAcesso {
  if (!e.ativa) return 'DESATIVADA';
  if (convitesDaEmpresa(e.id).length === 0) return 'NAO_CONVIDADA';
  if (e.trocaSenhaObrigatoria) {
    return e.senhaTemporariaExpiraEm && new Date(e.senhaTemporariaExpiraEm) > agora()
      ? 'CONVIDADA'
      : 'CONVITE_EXPIRADO';
  }
  return 'ATIVA';
}

/** Envios de um documento: geral (`obraId` null) ou da obra (`obraId`). Mais recente primeiro. */
export function enviosDe(empresaId: string, tipoId: string, obraId: string | null = null): EnvioDb[] {
  return db.envios
    .filter((e) => e.empresaId === empresaId && e.tipoDocumentoId === tipoId && e.obraId === obraId)
    .sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm));
}

interface SituacaoCalculada {
  situacao: SituacaoDocumento;
  envioAtual: EnvioDb | null;
  quantidade: number;
}

/** Regra da 001 sobre uma lista de envios (mais recente primeiro). */
function situacaoDeEnvios(envios: EnvioDb[]): SituacaoCalculada {
  const vivo = envios.find((e) => e.status !== 'REJEITADO');
  if (vivo) return { situacao: vivo.status, envioAtual: vivo, quantidade: envios.length };
  if (envios.length > 0) return { situacao: 'REJEITADO', envioAtual: envios[0], quantidade: envios.length };
  return { situacao: 'PENDENTE_ENVIO', envioAtual: null, quantidade: 0 };
}

const maiorIso = (...valores: string[]) => valores.reduce((a, b) => (b > a ? b : a));

/**
 * Janela de cobrança (FR-310), em datas de Brasília. Geral: desde max(cadastro da empresa,
 * `cobrancaDesde` do tipo). Por obra: desde max(vínculo, marcação, `cobrancaDesde`), até o
 * encerramento do vínculo (se encerrado). `null` = sem vínculo ou tipo não marcado.
 */
export function janelaCobranca(empresaId: string, tipo: TipoDb, obraId: string | null): { inicio: string; fim: string } | null {
  const empresa = db.empresas.find((e) => e.id === empresaId);
  if (!empresa) return null;
  const hoje = hojeLocal();
  if (obraId === null) return { inicio: dataLocal(maiorIso(empresa.criadoEm, tipo.cobrancaDesde)), fim: hoje };
  const vinculo = vinculoDe(obraId, empresaId);
  const marca = db.obraTipos.find((m) => m.obraId === obraId && m.tipoDocumentoId === tipo.id);
  if (!vinculo || !marca) return null;
  const fim = !vinculo.ativo && vinculo.encerradoEm ? dataLocal(vinculo.encerradoEm) : hoje;
  return { inicio: dataLocal(maiorIso(vinculo.vinculadoEm, marca.marcadoEm, tipo.cobrancaDesde)), fim };
}

/** Períodos exigidos (sem situação), do mais antigo para o mais recente. */
export function periodosCalculados(empresaId: string, tipo: TipoDb, obraId: string | null): PeriodoCalculado[] {
  const janela = janelaCobranca(empresaId, tipo, obraId);
  return janela ? gerarPeriodos(tipo.periodicidade, janela.inicio, janela.fim) : [];
}

export interface PeriodoDb extends PeriodoCalculado, SituacaoCalculada {
  atrasado: boolean;
}

/** Períodos com situação (data-model §3), do mais recente para o mais antigo. */
export function periodosDe(empresaId: string, tipo: TipoDb, obraId: string | null = null): PeriodoDb[] {
  const hoje = hojeLocal();
  const envios = enviosDe(empresaId, tipo.id, obraId);
  return periodosCalculados(empresaId, tipo, obraId)
    .map((p) => {
      const s = situacaoDeEnvios(envios.filter((e) => e.periodoInicio === p.inicio));
      const pedeAcao = s.situacao === 'PENDENTE_ENVIO' || s.situacao === 'REJEITADO';
      return { ...p, ...s, atrasado: pedeAcao && hoje > p.prazo };
    })
    .reverse();
}

export interface SituacaoDocumentoDb extends SituacaoCalculada {
  atrasado: boolean;
  /** null para tipo único. */
  periodos: ResumoPeriodos | null;
}

const pedeAcao = (p: PeriodoDb) => p.situacao === 'PENDENTE_ENVIO' || p.situacao === 'REJEITADO';

/**
 * Situação derivada (data-model §5 da 001/002), por empresa × tipo [× obra]. Tipo periódico: a do
 * período resumido (003, FR-312) — algum atrasado primeiro; senão REJEITADO > PENDENTE_ENVIO >
 * EM_ANALISE > APROVADO — com as contagens por período.
 */
export function situacaoDocumento(empresaId: string, tipoId: string, obraId: string | null = null): SituacaoDocumentoDb {
  const tipo = db.tipos.find((t) => t.id === tipoId);
  const envios = enviosDe(empresaId, tipoId, obraId);
  if (!tipo || tipo.periodicidade.unidade === 'UNICA') {
    return { ...situacaoDeEnvios(envios), atrasado: false, periodos: null };
  }
  const recentes = periodosDe(empresaId, tipo, obraId);
  const antigos = [...recentes].reverse();
  const resumo: ResumoPeriodos = { atrasados: 0, pendentes: 0, rejeitados: 0, emAnalise: 0, aprovados: 0, proximo: null };
  // Cada período conta uma vez pela situação; `atrasados` é o subconjunto de pendentes + rejeitados
  // com prazo vencido (mesma convenção de `ContagemDocumentos.periodosAtrasados`).
  for (const p of recentes) {
    if (p.atrasado) resumo.atrasados += 1;
    if (p.situacao === 'PENDENTE_ENVIO') resumo.pendentes += 1;
    else if (p.situacao === 'REJEITADO') resumo.rejeitados += 1;
    else if (p.situacao === 'EM_ANALISE') resumo.emAnalise += 1;
    else resumo.aprovados += 1;
  }
  const proximo = antigos.find(pedeAcao);
  resumo.proximo = proximo ? { inicio: proximo.inicio, fim: proximo.fim, rotulo: proximo.rotulo, prazo: proximo.prazo } : null;
  const escolhido =
    antigos.find((p) => p.atrasado) ??
    antigos.find((p) => p.situacao === 'REJEITADO') ??
    antigos.find((p) => p.situacao === 'PENDENTE_ENVIO') ??
    recentes.find((p) => p.situacao === 'EM_ANALISE') ??
    recentes[0];
  return {
    situacao: escolhido?.situacao ?? 'PENDENTE_ENVIO',
    envioAtual: escolhido?.envioAtual ?? null,
    quantidade: envios.length,
    atrasado: resumo.atrasados > 0,
    periodos: resumo,
  };
}

const porNome = (a: TipoDb, b: TipoDb) => a.nome.localeCompare(b.nome, 'pt-BR');

/** Tipos `GERAL` ativos: exigidos de toda empresa ativa (FR-202). */
export function tiposGeraisAtivos(): TipoDb[] {
  return db.tipos.filter((t) => t.ativo && t.abrangencia === 'GERAL').sort(porNome);
}

/** Tipos marcados como exigidos na obra (ativos e inativos), por nome. */
export function tiposMarcados(obraId: string): TipoDb[] {
  const ids = new Set(db.obraTipos.filter((m) => m.obraId === obraId).map((m) => m.tipoDocumentoId));
  return db.tipos.filter((t) => ids.has(t.id)).sort(porNome);
}

/** Tipos marcados e ativos na obra: os documentos da obra que contam (data-model §5). */
export function tiposMarcadosAtivos(obraId: string): TipoDb[] {
  return tiposMarcados(obraId).filter((t) => t.ativo);
}

export function vinculoDe(obraId: string, empresaId: string): VinculoDb | undefined {
  return db.vinculos.find((v) => v.obraId === obraId && v.empresaId === empresaId);
}

export function vinculosAtivosDaObra(obraId: string): VinculoDb[] {
  return db.vinculos.filter((v) => v.obraId === obraId && v.ativo);
}

function contar(empresaId: string, tipos: TipoDb[], obraId: string | null): ContagemDocumentos {
  const c: ContagemDocumentos = { total: 0, pendentes: 0, emAnalise: 0, aprovados: 0, rejeitados: 0, periodosAtrasados: 0 };
  for (const t of tipos) {
    c.total += 1;
    const { situacao, periodos } = situacaoDocumento(empresaId, t.id, obraId);
    c.periodosAtrasados += periodos?.atrasados ?? 0;
    if (situacao === 'PENDENTE_ENVIO') c.pendentes += 1;
    else if (situacao === 'EM_ANALISE') c.emAnalise += 1;
    else if (situacao === 'APROVADO') c.aprovados += 1;
    else c.rejeitados += 1;
  }
  return c;
}

/** Contagem dos documentos gerais (`total` = tipos GERAL ativos). */
export function contagemDocumentos(empresaId: string): ContagemDocumentos {
  return contar(empresaId, tiposGeraisAtivos(), null);
}

/** Contagem dos documentos da obra para a empresa (`total` = tipos marcados ativos na obra). */
export function contagemDocumentosObra(empresaId: string, obraId: string): ContagemDocumentos {
  return contar(empresaId, tiposMarcadosAtivos(obraId), obraId);
}

const comPendencia = (c: ContagemDocumentos) => c.pendentes + c.rejeitados > 0;

/** Documento da obra é exigido ⇔ empresa ativa ∧ vínculo ativo ∧ obra ativa (∧ tipo ativo e marcado). */
function obraExigeDaEmpresa(obraId: string, empresaId: string): boolean {
  const obra = db.obras.find((o) => o.id === obraId);
  const empresa = db.empresas.find((e) => e.id === empresaId);
  return Boolean(obra?.ativa && empresa?.ativa && vinculoDe(obraId, empresaId)?.ativo);
}

/** Pendência da empresa só nos documentos da obra (exigidos). */
export function temPendenciaNaObra(empresaId: string, obraId: string): boolean {
  return obraExigeDaEmpresa(obraId, empresaId) && comPendencia(contagemDocumentosObra(empresaId, obraId));
}

/** Empresa com pendência: geral ou em alguma obra ativa com vínculo ativo (data-model §5). */
export function temPendencia(e: EmpresaDb): boolean {
  if (comPendencia(contagemDocumentos(e.id))) return true;
  return db.vinculos.some((v) => v.empresaId === e.id && v.ativo && temPendenciaNaObra(e.id, v.obraId));
}

/** Empresa com algum período atrasado: geral ou em obra exigida (003, FR-322). */
export function temAtraso(e: EmpresaDb): boolean {
  if (contagemDocumentos(e.id).periodosAtrasados > 0) return true;
  return db.vinculos.some(
    (v) =>
      v.empresaId === e.id &&
      v.ativo &&
      obraExigeDaEmpresa(v.obraId, e.id) &&
      contagemDocumentosObra(e.id, v.obraId).periodosAtrasados > 0,
  );
}

/** Obra com pendência: obra ativa com alguma empresa ativa (vínculo ativo) com documento da obra pendente/rejeitado. */
export function obraTemPendencia(o: ObraDb): boolean {
  return o.ativa && vinculosAtivosDaObra(o.id).some((v) => temPendenciaNaObra(v.empresaId, o.id));
}

// ───────────────────────────── Conversões para o contrato ─────────────────────────────

export function paraObra(o: ObraDb): Obra {
  return { id: o.id, nome: o.nome, codigo: o.codigo, cidade: o.cidade, uf: o.uf, ativa: o.ativa, criadoEm: o.criadoEm };
}

export function paraObraRef(o: ObraDb): ObraRef {
  return { id: o.id, nome: o.nome, cidade: o.cidade, uf: o.uf };
}

export function paraConvite(c: ConviteDb): Convite {
  return {
    id: c.id,
    emailDestino: c.emailDestino,
    enviadoEm: c.enviadoEm,
    expiraEm: c.expiraEm,
    usadoEm: c.usadoEm,
    enviadoPor: c.enviadoPor,
    situacao: situacaoConvite(c),
  };
}

/** `documentosObra` só quando a lista foi filtrada por obra (`obraIdFiltro`). */
export function paraEmpresaResumo(e: EmpresaDb, obraIdFiltro?: string | null): EmpresaResumo {
  return {
    id: e.id,
    razaoSocial: e.razaoSocial,
    nomeFantasia: e.nomeFantasia,
    cnpj: e.cnpj,
    emailContato: e.emailContato,
    ativa: e.ativa,
    situacaoAcesso: situacaoAcesso(e),
    documentos: contagemDocumentos(e.id),
    documentosObra: obraIdFiltro ? contagemDocumentosObra(e.id, obraIdFiltro) : null,
  };
}

export function paraObraNaEmpresa(o: ObraDb, v: VinculoDb): ObraNaEmpresa {
  return {
    ...paraObraRef(o),
    vinculoAtivo: v.ativo,
    obraAtiva: o.ativa,
    documentos: contagemDocumentosObra(v.empresaId, o.id),
  };
}

export function paraEmpresa(e: EmpresaDb): Empresa {
  const convites = convitesDaEmpresa(e.id);
  const obras = db.vinculos
    .filter((v) => v.empresaId === e.id)
    .map((v) => ({ v, o: db.obras.find((o) => o.id === v.obraId) }))
    .filter((x): x is { v: VinculoDb; o: ObraDb } => Boolean(x.o))
    .sort((a, b) => a.o.nome.localeCompare(b.o.nome, 'pt-BR'))
    .map(({ v, o }) => paraObraNaEmpresa(o, v));
  return {
    ...paraEmpresaResumo(e),
    nomeContato: e.nomeContato,
    telefone: e.telefone,
    obras,
    cnpjEditavel: convites.length === 0,
    ultimoConvite: convites[0] ? paraConvite(convites[0]) : null,
    ultimoAcessoEm: e.ultimoAcessoEm,
    criadoEm: e.criadoEm,
  };
}

export function quantidadeEnviosNaObra(empresaId: string, obraId: string): number {
  return db.envios.filter((x) => x.empresaId === empresaId && x.obraId === obraId).length;
}

export function paraEmpresaNaObra(e: EmpresaDb, v: VinculoDb): EmpresaNaObra {
  return {
    empresaId: e.id,
    razaoSocial: e.razaoSocial,
    cnpj: e.cnpj,
    situacaoAcesso: situacaoAcesso(e),
    vinculadoEm: v.vinculadoEm,
    documentosObra: contagemDocumentosObra(e.id, v.obraId),
    documentosGerais: contagemDocumentos(e.id),
    quantidadeEnviosNaObra: quantidadeEnviosNaObra(e.id, v.obraId),
  };
}

export function paraVinculoEncerrado(e: EmpresaDb, v: VinculoDb): VinculoEncerrado {
  return {
    empresaId: e.id,
    razaoSocial: e.razaoSocial,
    cnpj: e.cnpj,
    encerradoEm: v.encerradoEm ?? v.vinculadoEm,
    encerradoPorLogin: v.encerradoPorLogin,
    quantidadeEnvios: quantidadeEnviosNaObra(e.id, v.obraId),
  };
}

export function paraPeriodicidade(p: Periodicidade): Periodicidade {
  return {
    unidade: p.unidade,
    intervalo: p.unidade === 'UNICA' ? null : (p.intervalo ?? null),
    prazoDias: p.unidade === 'UNICA' ? null : (p.prazoDias ?? null),
    descricao: descreverPeriodicidade(p),
  };
}

export function paraTipo(t: TipoDb): TipoDocumento {
  return {
    id: t.id,
    nome: t.nome,
    instrucoes: t.instrucoes,
    abrangencia: t.abrangencia,
    periodicidade: paraPeriodicidade(t.periodicidade),
    ativo: t.ativo,
    criadoEm: t.criadoEm,
  };
}

export function paraTipoRef(t: TipoDb): TipoDocumentoRef {
  return {
    id: t.id,
    nome: t.nome,
    instrucoes: t.instrucoes,
    abrangencia: t.abrangencia,
    periodicidade: paraPeriodicidade(t.periodicidade),
  };
}

export function paraTipoExigidoObra(obraId: string, t: TipoDb): TipoExigidoObra {
  const marca = db.obraTipos.find((m) => m.obraId === obraId && m.tipoDocumentoId === t.id);
  return { tipoDocumento: paraTipo(t), exigido: Boolean(marca), marcadoEm: marca?.marcadoEm ?? null };
}

export function paraEnvio(e: EnvioDb): Envio {
  const { periodoInicio, periodoFim, ...resto } = e;
  const tipo = db.tipos.find((t) => t.id === e.tipoDocumentoId);
  const periodo =
    periodoInicio && periodoFim && tipo
      ? { inicio: periodoInicio, fim: periodoFim, rotulo: rotuloPeriodo(tipo.periodicidade, periodoInicio, periodoFim) }
      : null;
  return { ...resto, periodo };
}

export function paraPeriodo(p: PeriodoDb): Periodo {
  return {
    inicio: p.inicio,
    fim: p.fim,
    rotulo: p.rotulo,
    prazo: p.prazo,
    situacao: p.situacao,
    atrasado: p.atrasado,
    envioAtual: p.envioAtual ? paraEnvio(p.envioAtual) : null,
    quantidadeEnvios: p.quantidade,
  };
}

export function paraEnvioFila(e: EnvioDb): EnvioFila {
  const empresa = db.empresas.find((x) => x.id === e.empresaId)!;
  const tipo = db.tipos.find((x) => x.id === e.tipoDocumentoId)!;
  const obra = e.obraId ? db.obras.find((o) => o.id === e.obraId) : undefined;
  return {
    ...paraEnvio(e),
    empresa: { id: empresa.id, razaoSocial: empresa.razaoSocial, cnpj: empresa.cnpj },
    tipoDocumento: paraTipoRef(tipo),
    obra: obra ? paraObraRef(obra) : null,
  };
}

export function paraDocumentoSituacao(empresaId: string, t: TipoDb, obraId: string | null = null): DocumentoSituacao {
  const { situacao, envioAtual, quantidade, atrasado, periodos } = situacaoDocumento(empresaId, t.id, obraId);
  return {
    tipoDocumento: paraTipoRef(t),
    situacao,
    envioAtual: envioAtual ? paraEnvio(envioAtual) : null,
    quantidadeEnvios: quantidade,
    atrasado,
    periodos,
  };
}

export function situacaoUsuario(u: UsuarioInternoDb): SituacaoUsuarioInterno {
  if (!u.ativo) return 'DESATIVADO';
  if (!u.trocaSenhaObrigatoria) return 'ATIVO';
  const expira = u.senhaProvisoriaExpiraEm ? new Date(u.senhaProvisoriaExpiraEm).getTime() : 0;
  return expira > agora().getTime() ? 'AGUARDANDO_PRIMEIRO_ACESSO' : 'SENHA_PROVISORIA_EXPIRADA';
}

export function paraUsuarioInterno(u: UsuarioInternoDb): UsuarioInterno {
  const bloqueado = u.bloqueadoAte && new Date(u.bloqueadoAte).getTime() > agora().getTime();
  return {
    id: u.id,
    login: u.login,
    nome: u.nome,
    email: u.email,
    admin: u.admin,
    ativo: u.ativo,
    situacao: situacaoUsuario(u),
    senhaProvisoriaExpiraEm: u.trocaSenhaObrigatoria ? u.senhaProvisoriaExpiraEm : null,
    bloqueadoAte: bloqueado ? u.bloqueadoAte : null,
    ultimoAcessoEm: u.ultimoAcessoEm,
    criadoEm: u.criadoEm,
    criadoPor: u.criadoPor,
    atualizadoEm: u.atualizadoEm,
  };
}

export function paraUsuarioFluig(u: UsuarioInternoDb): UsuarioFluig {
  return {
    login: u.login,
    nome: u.nome,
    email: u.email,
    admin: u.admin,
    origem: 'LOGIN_LOCAL',
    trocaSenhaObrigatoria: u.trocaSenhaObrigatoria,
  };
}

semear();
semearUsuarios();
