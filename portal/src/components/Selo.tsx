import type { SituacaoDocumento } from '../api/tipos';
import { IconeAlerta, IconeCheck, IconeRelogio, IconeX } from './icons';
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

export function Selo({ situacao }: { situacao: SituacaoDocumento }) {
  const Icone = ICONE[situacao];
  return (
    <span className={`jn-selo jn-selo--${situacao.toLowerCase()}`}>
      <Icone tamanho={14} />
      {TEXTO_SITUACAO[situacao]}
    </span>
  );
}
