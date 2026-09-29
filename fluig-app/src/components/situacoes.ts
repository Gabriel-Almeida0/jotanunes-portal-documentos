import type {
  SituacaoAcesso,
  SituacaoConvite,
  SituacaoDocumento,
  SituacaoUsuarioInterno,
  StatusEnvio,
} from '../api/tipos';

export type TomSelo = 'sucesso' | 'info' | 'aviso' | 'perigo' | 'neutro';

export type Situacao =
  | SituacaoDocumento
  | StatusEnvio
  | SituacaoAcesso
  | SituacaoConvite
  | SituacaoUsuarioInterno;

/** Texto e tom de cada situação (docs/design.md §3.4). O texto é sempre exibido. */
export const SITUACOES: Record<Situacao, { texto: string; tom: TomSelo }> = {
  PENDENTE_ENVIO: { texto: 'Pendente de envio', tom: 'aviso' },
  EM_ANALISE: { texto: 'Em análise', tom: 'info' },
  APROVADO: { texto: 'Aprovado', tom: 'sucesso' },
  REJEITADO: { texto: 'Rejeitado', tom: 'perigo' },
  NAO_CONVIDADA: { texto: 'Não convidada', tom: 'neutro' },
  CONVIDADA: { texto: 'Convidada', tom: 'info' },
  CONVITE_EXPIRADO: { texto: 'Convite expirado', tom: 'aviso' },
  ATIVA: { texto: 'Acesso ativo', tom: 'sucesso' },
  DESATIVADA: { texto: 'Desativada', tom: 'neutro' },
  VALIDO: { texto: 'Válido', tom: 'info' },
  USADO: { texto: 'Usado', tom: 'sucesso' },
  EXPIRADO: { texto: 'Expirado', tom: 'aviso' },
  SUBSTITUIDO: { texto: 'Substituído', tom: 'neutro' },
  // Usuário interno (login próprio da área Jotanunes, data-model §10)
  AGUARDANDO_PRIMEIRO_ACESSO: { texto: 'Aguardando primeiro acesso', tom: 'info' },
  SENHA_PROVISORIA_EXPIRADA: { texto: 'Senha provisória expirada', tom: 'aviso' },
  ATIVO: { texto: 'Ativo', tom: 'sucesso' },
  DESATIVADO: { texto: 'Desativado', tom: 'neutro' },
};

export function textoSituacao(situacao: Situacao): string {
  return SITUACOES[situacao]?.texto ?? situacao;
}

