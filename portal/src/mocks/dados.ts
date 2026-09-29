/**
 * Banco em memória dos mocks do portal. Segue os schemas do contrato (`openapi.yaml`).
 * Credenciais (quickstart §5): CNPJ 12.345.678/0001-95, senha temporária `Temp1234`
 * (troca obrigatória) e depois a senha nova (ex.: `Nova1234`).
 */
import type {
  DocumentoSituacaoPortal,
  EmpresaPortal,
  EnvioPortal,
  FormatoArquivo,
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
}

export interface TipoMock {
  id: string;
  nome: string;
  instrucoes: string | null;
}

export interface EnvioMock extends EnvioPortal {
  empresaId: string;
  conteudo: Uint8Array;
}

interface Banco {
  empresas: EmpresaMock[];
  tipos: TipoMock[];
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
): EnvioMock {
  return {
    id: uuid(n),
    empresaId,
    tipoDocumentoId: tipoId,
    nomeArquivo,
    formato: 'application/pdf',
    tamanhoBytes: PDF_MINIMO.byteLength,
    enviadoEm: horasAtras(enviadoHa),
    status,
    analisadoEm: status === 'EM_ANALISE' ? null : horasAtras(enviadoHa - 20),
    motivoRejeicao,
    conteudo: PDF_MINIMO,
  };
}

function criarBanco(): Banco {
  const tipos: TipoMock[] = [
    {
      id: uuid(101),
      nome: 'Cartão CNPJ',
      instrucoes:
        'Comprovante de inscrição emitido no site da Receita Federal há no máximo 30 dias.',
    },
    {
      id: uuid(102),
      nome: 'Certidão Negativa de Débitos Federais',
      instrucoes: 'Certidão conjunta da Receita Federal e da PGFN, dentro da validade.',
    },
    {
      id: uuid(103),
      nome: 'PCMSO',
      instrucoes:
        'Programa de Controle Médico de Saúde Ocupacional assinado pelo médico responsável.',
    },
  ];

  const empresas: EmpresaMock[] = [
    // Primeiro acesso: troca obrigatória; 3 documentos pendentes.
    empresa(
      1,
      'Exemplo Serviços de Engenharia Ltda',
      CNPJ_EXEMPLO,
      SENHA_TEMPORARIA_EXEMPLO,
      {},
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
  ];

  return {
    empresas,
    tipos,
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

export function enviosDaEmpresa(empresaId: string, tipoId: string): EnvioPortal[] {
  return banco.envios
    .filter((e) => e.empresaId === empresaId && e.tipoDocumentoId === tipoId)
    .sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm))
    .map(semConteudo);
}

export function documentosDaEmpresa(empresaId: string): DocumentoSituacaoPortal[] {
  return banco.tipos
    .map((tipo): DocumentoSituacaoPortal => {
      const [atual] = enviosDaEmpresa(empresaId, tipo.id);
      const situacao: SituacaoDocumento = atual ? atual.status : 'PENDENTE_ENVIO';
      return {
        tipoDocumento: { ...tipo },
        situacao,
        envioAtual: atual ?? null,
        podeEnviar: situacao === 'PENDENTE_ENVIO' || situacao === 'REJEITADO',
      };
    })
    .sort(
      (a, b) =>
        ORDEM[a.situacao] - ORDEM[b.situacao] ||
        a.tipoDocumento.nome.localeCompare(b.tipoDocumento.nome, 'pt-BR'),
    );
}

/** Detecta o formato pela assinatura de bytes (research R6). */
export function detectarFormato(bytes: Uint8Array): FormatoArquivo | null {
  const comeca = (assinatura: number[]) => assinatura.every((b, i) => bytes[i] === b);
  if (comeca([0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  if (comeca([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (comeca([0xff, 0xd8, 0xff])) return 'image/jpeg';
  return null;
}
