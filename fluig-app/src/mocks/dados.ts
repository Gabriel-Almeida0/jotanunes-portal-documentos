/**
 * Banco em memória dos mocks MSW. As estruturas internas seguem `data-model.md`; os handlers só
 * devolvem objetos no formato dos schemas de `contracts/openapi.yaml` (funções `para*` abaixo).
 * `reiniciarDados()` restaura a semente (usado entre testes).
 */
import type {
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
  ObraRef,
  SituacaoAcesso,
  SituacaoConvite,
  SituacaoDocumento,
  StatusEnvio,
  TipoDocumento,
  Uf,
  UsuarioFluig,
} from '../api/tipos';

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

export interface VinculoDb {
  obraId: string;
  empresaId: string;
  vinculadoEm: string;
}

export interface TipoDb {
  id: string;
  nome: string;
  instrucoes: string | null;
  ativo: boolean;
  criadoEm: string;
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
  nomeArquivo: string;
  formato: FormatoArquivo;
  tamanhoBytes: number;
  enviadoEm: string;
  status: StatusEnvio;
  analisadoEm: string | null;
  analisadoPor: AutorFluig | null;
  motivoRejeicao: string | null;
}

export const USUARIO_MOCK: UsuarioFluig = {
  login: 'dev.analista',
  nome: 'Analista Dev',
  email: 'analista@jotanunes.com',
};

const OUTRA_ANALISTA: AutorFluig = { login: 'maria.silva', nome: 'Maria Silva' };

export const db = {
  obras: [] as ObraDb[],
  empresas: [] as EmpresaDb[],
  vinculos: [] as VinculoDb[],
  tipos: [] as TipoDb[],
  convites: [] as ConviteDb[],
  envios: [] as EnvioDb[],
};

let sequencia = 0;
/** UUID v4 determinístico o bastante para os mocks. */
export function novoId(): string {
  sequencia += 1;
  const hex = sequencia.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

export function agora(): Date {
  return new Date();
}

export function agoraIso(): string {
  return agora().toISOString();
}

function ha(dias: number, horas = 0): string {
  return new Date(agora().getTime() - (dias * 24 + horas) * 3_600_000).toISOString();
}

function daqui(dias: number): string {
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
} as const;

function semear(): void {
  sequencia = 0;
  db.obras.splice(0, db.obras.length, ...[
    { id: IDS.obraVistaDoRio, nome: 'Residencial Vista do Rio', codigo: 'VDR-01', cidade: 'Aracaju', uf: 'SE' as Uf, ativa: true, criadoEm: ha(60) },
    { id: IDS.obraFlorDeSal, nome: 'Condomínio Flor de Sal', codigo: 'FDS-02', cidade: 'Aracaju', uf: 'SE' as Uf, ativa: true, criadoEm: ha(45) },
    { id: IDS.obraPalmeiras, nome: 'Parque das Palmeiras', codigo: null, cidade: 'Maceió', uf: 'AL' as Uf, ativa: false, criadoEm: ha(300) },
  ]);

  db.tipos.splice(0, db.tipos.length, ...[
    { id: IDS.tipoAso, nome: 'ASO — Atestado de Saúde Ocupacional', instrucoes: 'Envie o ASO admissional de cada trabalhador que vai atuar na obra, assinado pelo médico do trabalho.', ativo: true, criadoEm: ha(90) },
    { id: IDS.tipoCartaoCnpj, nome: 'Cartão CNPJ', instrucoes: 'Comprovante de inscrição emitido no site da Receita Federal há no máximo 30 dias.', ativo: true, criadoEm: ha(90) },
    { id: IDS.tipoCndFederal, nome: 'CND Federal', instrucoes: 'Certidão negativa (ou positiva com efeito de negativa) de débitos federais, dentro da validade.', ativo: true, criadoEm: ha(90) },
    { id: IDS.tipoPcmso, nome: 'PCMSO', instrucoes: null, ativo: true, criadoEm: ha(80) },
    { id: IDS.tipoAlvara, nome: 'Alvará de funcionamento (antigo)', instrucoes: 'Não é mais exigido.', ativo: false, criadoEm: ha(200) },
  ]);

  db.empresas.splice(0, db.empresas.length, ...[
    { id: IDS.empresaAlfa, razaoSocial: 'Alfa Engenharia Ltda', nomeFantasia: 'Alfa Engenharia', cnpj: '11222333000181', emailContato: 'contato@alfa.test', nomeContato: 'Carlos Menezes', telefone: '79999991234', ativa: true, criadoEm: ha(40), trocaSenhaObrigatoria: false, senhaTemporariaExpiraEm: null, ultimoAcessoEm: ha(1, 3) },
    { id: IDS.empresaBeta, razaoSocial: 'Beta Serviços de Montagem S.A.', nomeFantasia: 'Beta Serviços', cnpj: '12ABC34501DE35', emailContato: 'contato@beta.test', nomeContato: null, telefone: null, ativa: true, criadoEm: ha(20), trocaSenhaObrigatoria: true, senhaTemporariaExpiraEm: daqui(5), ultimoAcessoEm: null },
    { id: IDS.empresaGama, razaoSocial: 'Gama Instalações Elétricas Ltda', nomeFantasia: null, cnpj: '12345678000195', emailContato: 'financeiro@gama.test', nomeContato: 'Rita Souza', telefone: '7932221234', ativa: true, criadoEm: ha(3), trocaSenhaObrigatoria: false, senhaTemporariaExpiraEm: null, ultimoAcessoEm: null },
    { id: IDS.empresaDelta, razaoSocial: 'Delta Pinturas e Acabamentos ME', nomeFantasia: 'Delta Pinturas', cnpj: '33445566000186', emailContato: 'delta@delta.test', nomeContato: null, telefone: null, ativa: true, criadoEm: ha(30), trocaSenhaObrigatoria: true, senhaTemporariaExpiraEm: ha(2), ultimoAcessoEm: null },
    { id: IDS.empresaEpsilon, razaoSocial: 'Épsilon Terraplenagem Ltda', nomeFantasia: null, cnpj: '99887766000105', emailContato: 'contato@epsilon.test', nomeContato: null, telefone: null, ativa: false, criadoEm: ha(120), trocaSenhaObrigatoria: false, senhaTemporariaExpiraEm: null, ultimoAcessoEm: ha(100) },
    { id: IDS.empresaZeta, razaoSocial: 'Zeta Andaimes e Equipamentos Ltda', nomeFantasia: 'Zeta Andaimes', cnpj: '44556677000186', emailContato: 'docs@zeta.test', nomeContato: 'Paulo Lima', telefone: '79988887777', ativa: true, criadoEm: ha(25), trocaSenhaObrigatoria: false, senhaTemporariaExpiraEm: null, ultimoAcessoEm: ha(0, 5) },
  ]);

  db.vinculos.splice(0, db.vinculos.length, ...[
    { obraId: IDS.obraVistaDoRio, empresaId: IDS.empresaAlfa, vinculadoEm: ha(39) },
    { obraId: IDS.obraVistaDoRio, empresaId: IDS.empresaBeta, vinculadoEm: ha(19) },
    { obraId: IDS.obraVistaDoRio, empresaId: IDS.empresaZeta, vinculadoEm: ha(24) },
    { obraId: IDS.obraFlorDeSal, empresaId: IDS.empresaAlfa, vinculadoEm: ha(30) },
    { obraId: IDS.obraFlorDeSal, empresaId: IDS.empresaDelta, vinculadoEm: ha(29) },
    { obraId: IDS.obraPalmeiras, empresaId: IDS.empresaEpsilon, vinculadoEm: ha(290) },
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

  db.envios.splice(0, db.envios.length, ...[
    { id: IDS.envioAlfaCnpj, empresaId: IDS.empresaAlfa, tipoDocumentoId: IDS.tipoCartaoCnpj, nomeArquivo: 'cartao-cnpj-alfa.pdf', formato: 'application/pdf' as FormatoArquivo, tamanhoBytes: 184_320, enviadoEm: ha(12), status: 'APROVADO' as StatusEnvio, analisadoEm: ha(11), analisadoPor: OUTRA_ANALISTA, motivoRejeicao: null },
    { id: IDS.envioAlfaCndRejeitado, empresaId: IDS.empresaAlfa, tipoDocumentoId: IDS.tipoCndFederal, nomeArquivo: 'cnd-federal.jpg', formato: 'image/jpeg' as FormatoArquivo, tamanhoBytes: 1_572_864, enviadoEm: ha(10), status: 'REJEITADO' as StatusEnvio, analisadoEm: ha(9), analisadoPor: analista, motivoRejeicao: 'Documento ilegível, envie de novo em PDF.' },
    { id: IDS.envioAlfaPcmso, empresaId: IDS.empresaAlfa, tipoDocumentoId: IDS.tipoPcmso, nomeArquivo: 'PCMSO 2026 - Alfa Engenharia.pdf', formato: 'application/pdf' as FormatoArquivo, tamanhoBytes: 2_411_724, enviadoEm: ha(3, 6), status: 'EM_ANALISE' as StatusEnvio, analisadoEm: null, analisadoPor: null, motivoRejeicao: null },
    { id: IDS.envioZetaAso, empresaId: IDS.empresaZeta, tipoDocumentoId: IDS.tipoAso, nomeArquivo: 'aso-equipe-zeta.pdf', formato: 'application/pdf' as FormatoArquivo, tamanhoBytes: 734_003, enviadoEm: ha(2, 2), status: 'EM_ANALISE' as StatusEnvio, analisadoEm: null, analisadoPor: null, motivoRejeicao: null },
    { id: IDS.envioZetaCnpj, empresaId: IDS.empresaZeta, tipoDocumentoId: IDS.tipoCartaoCnpj, nomeArquivo: 'cartao_cnpj.png', formato: 'image/png' as FormatoArquivo, tamanhoBytes: 402_115, enviadoEm: ha(0, 4), status: 'EM_ANALISE' as StatusEnvio, analisadoEm: null, analisadoPor: null, motivoRejeicao: null },
    // Envios de um tipo desativado depois (continuam no histórico — Edge Case da spec, T120).
    { id: IDS.envioAlfaAlvaraRejeitado, empresaId: IDS.empresaAlfa, tipoDocumentoId: IDS.tipoAlvara, nomeArquivo: 'alvara-2025.jpg', formato: 'image/jpeg' as FormatoArquivo, tamanhoBytes: 655_360, enviadoEm: ha(35), status: 'REJEITADO' as StatusEnvio, analisadoEm: ha(34), analisadoPor: OUTRA_ANALISTA, motivoRejeicao: 'Alvará vencido.' },
    { id: IDS.envioAlfaAlvaraAprovado, empresaId: IDS.empresaAlfa, tipoDocumentoId: IDS.tipoAlvara, nomeArquivo: 'alvara-2026.pdf', formato: 'application/pdf' as FormatoArquivo, tamanhoBytes: 212_992, enviadoEm: ha(33), status: 'APROVADO' as StatusEnvio, analisadoEm: ha(32), analisadoPor: analista, motivoRejeicao: null },
    { id: IDS.envioAlfaAso, empresaId: IDS.empresaAlfa, tipoDocumentoId: IDS.tipoAso, nomeArquivo: 'aso-alfa.pdf', formato: 'application/pdf' as FormatoArquivo, tamanhoBytes: 98_304, enviadoEm: ha(8), status: 'APROVADO' as StatusEnvio, analisadoEm: ha(7), analisadoPor: analista, motivoRejeicao: null },
  ]);
}

export function reiniciarDados(): void {
  semear();
}

semear();

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

export function enviosDe(empresaId: string, tipoId: string): EnvioDb[] {
  return db.envios
    .filter((e) => e.empresaId === empresaId && e.tipoDocumentoId === tipoId)
    .sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm));
}

export function situacaoDocumento(
  empresaId: string,
  tipoId: string,
): { situacao: SituacaoDocumento; envioAtual: EnvioDb | null; quantidade: number } {
  const envios = enviosDe(empresaId, tipoId);
  const vivo = envios.find((e) => e.status !== 'REJEITADO');
  if (vivo) return { situacao: vivo.status, envioAtual: vivo, quantidade: envios.length };
  if (envios.length > 0) return { situacao: 'REJEITADO', envioAtual: envios[0], quantidade: envios.length };
  return { situacao: 'PENDENTE_ENVIO', envioAtual: null, quantidade: 0 };
}

export function tiposAtivos(): TipoDb[] {
  return db.tipos.filter((t) => t.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function contagemDocumentos(empresaId: string): ContagemDocumentos {
  const c: ContagemDocumentos = { total: 0, pendentes: 0, emAnalise: 0, aprovados: 0, rejeitados: 0 };
  for (const t of tiposAtivos()) {
    c.total += 1;
    const { situacao } = situacaoDocumento(empresaId, t.id);
    if (situacao === 'PENDENTE_ENVIO') c.pendentes += 1;
    else if (situacao === 'EM_ANALISE') c.emAnalise += 1;
    else if (situacao === 'APROVADO') c.aprovados += 1;
    else c.rejeitados += 1;
  }
  return c;
}

export function temPendencia(e: EmpresaDb): boolean {
  const c = contagemDocumentos(e.id);
  return c.pendentes + c.rejeitados > 0;
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

export function paraEmpresaResumo(e: EmpresaDb): EmpresaResumo {
  return {
    id: e.id,
    razaoSocial: e.razaoSocial,
    nomeFantasia: e.nomeFantasia,
    cnpj: e.cnpj,
    emailContato: e.emailContato,
    ativa: e.ativa,
    situacaoAcesso: situacaoAcesso(e),
    documentos: contagemDocumentos(e.id),
  };
}

export function paraEmpresa(e: EmpresaDb): Empresa {
  const convites = convitesDaEmpresa(e.id);
  const obras = db.vinculos
    .filter((v) => v.empresaId === e.id)
    .map((v) => db.obras.find((o) => o.id === v.obraId))
    .filter((o): o is ObraDb => Boolean(o))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map(paraObraRef);
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

export function paraEmpresaNaObra(e: EmpresaDb, v: VinculoDb): EmpresaNaObra {
  return {
    empresaId: e.id,
    razaoSocial: e.razaoSocial,
    cnpj: e.cnpj,
    situacaoAcesso: situacaoAcesso(e),
    vinculadoEm: v.vinculadoEm,
    documentos: contagemDocumentos(e.id),
  };
}

export function paraTipo(t: TipoDb): TipoDocumento {
  return { id: t.id, nome: t.nome, instrucoes: t.instrucoes, ativo: t.ativo, criadoEm: t.criadoEm };
}

export function paraEnvio(e: EnvioDb): Envio {
  return { ...e };
}

export function paraEnvioFila(e: EnvioDb): EnvioFila {
  const empresa = db.empresas.find((x) => x.id === e.empresaId)!;
  const tipo = db.tipos.find((x) => x.id === e.tipoDocumentoId)!;
  return {
    ...paraEnvio(e),
    empresa: { id: empresa.id, razaoSocial: empresa.razaoSocial, cnpj: empresa.cnpj },
    tipoDocumento: { id: tipo.id, nome: tipo.nome, instrucoes: tipo.instrucoes },
  };
}

export function paraDocumentoSituacao(empresaId: string, t: TipoDb): DocumentoSituacao {
  const { situacao, envioAtual, quantidade } = situacaoDocumento(empresaId, t.id);
  return {
    tipoDocumento: { id: t.id, nome: t.nome, instrucoes: t.instrucoes },
    situacao,
    envioAtual: envioAtual ? paraEnvio(envioAtual) : null,
    quantidadeEnvios: quantidade,
  };
}
