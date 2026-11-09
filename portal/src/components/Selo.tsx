import type { SituacaoDocumento } from '../api/tipos';
import { IconeAlerta, IconeAtraso, IconeCheck, IconeRelogio, IconeX } from './icons';
import './Selo.css';

/** Texto de cada situação — o selo SEMPRE mostra texto (FR-072), a cor é só reforço. */
const TEXTO_SITUACAO: Record<SituacaoDocumento, string> = {
  PENDENTE_ENVIO: 'Pendente de envio',
  EM_ANALISE: 'Em análise',
  APROVADO: 'Aprovado',
  REJEITADO: 'Rejeitado',
};

const ICONE: Record<SituacaoDocumento, typeof IconeCheck> = {
  PENDENTE_ENVIO: IconeAlerta,
  EM_ANALISE: IconeRelogio,
  APROVADO: IconeCheck,
  REJEITADO: IconeX,
};

function SeloAtrasado() {
  return (
    <span className="jn-selo jn-selo--atrasado">
      <IconeAtraso tamanho={14} />
      Atrasado
    </span>
  );
}

interface Props {
  situacao: SituacaoDocumento;
  /**
   * Prazo do período vencido (documento periódico). Pendente + atrasado vira só "Atrasado";
   * rejeitado + atrasado mostra os dois selos.
   */
  atrasado?: boolean;
}

export function Selo({ situacao, atrasado = false }: Props) {
  if (atrasado && situacao === 'PENDENTE_ENVIO') return <SeloAtrasado />;
  const Icone = ICONE[situacao];
  const selo = (
    <span className={`jn-selo jn-selo--${situacao.toLowerCase()}`}>
      <Icone tamanho={14} />
      {TEXTO_SITUACAO[situacao]}
    </span>
  );
  if (!atrasado) return selo;
  return (
    <span className="jn-selos">
      {selo}
      <SeloAtrasado />
    </span>
  );
}
