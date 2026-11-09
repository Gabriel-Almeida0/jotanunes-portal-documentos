import type { ReactNode } from 'react';
import { IconeAlerta, IconeCirculo, IconeCirculoCheck, IconeCirculoX, IconeRelogio } from './icons';
import type { Abrangencia, SituacaoDocumento } from '../api/tipos';
import { SITUACOES, TEXTO_ABRANGENCIA, type Situacao, type TomSelo } from './situacoes';
import './Selo.css';

export type { Situacao, TomSelo };

const ICONES: Record<TomSelo, (p: { tamanho: number }) => ReactNode> = {
  sucesso: IconeCirculoCheck,
  info: IconeRelogio,
  aviso: IconeAlerta,
  perigo: IconeCirculoX,
  neutro: IconeCirculo,
};

export interface SeloProps {
  tom: TomSelo;
  children: ReactNode;
  comIcone?: boolean;
}

export function Selo({ tom, children, comIcone = true }: SeloProps) {
  const Icone = ICONES[tom];
  return (
    <span className="jn-selo" data-tom={tom}>
      {comIcone ? <Icone tamanho={14} /> : null}
      <span className="jn-selo__texto">{children}</span>
    </span>
  );
}

export function SeloSituacao({ situacao }: { situacao: Situacao }) {
  const { texto, tom } = SITUACOES[situacao] ?? { texto: situacao, tom: 'neutro' as TomSelo };
  return <Selo tom={tom}>{texto}</Selo>;
}

/** Período com prazo vencido sem envio aceito (003). Sempre escrito, nunca só cor. */
export function SeloAtrasado() {
  return <Selo tom="perigo">Atrasado</Selo>;
}

/** Envio feito depois do prazo do período (003, `enviadoComAtraso`). */
export function SeloComAtraso() {
  return <Selo tom="aviso">Com atraso</Selo>;
}

/**
 * Situação de um período (ou a resumida de um documento periódico): "Atrasado" quando o prazo
 * passou; se o período atrasado estiver rejeitado, mostra os dois selos.
 */
export function SeloSituacaoPeriodo({ situacao, atrasado }: { situacao: SituacaoDocumento; atrasado: boolean }) {
  if (!atrasado) return <SeloSituacao situacao={situacao} />;
  if (situacao !== 'REJEITADO') return <SeloAtrasado />;
  return (
    <span className="jn-selos">
      <SeloAtrasado />
      <SeloSituacao situacao="REJEITADO" />
    </span>
  );
}

/** Selo "Ativo/Inativo" (ou "Ativa/Inativa") para cadastros. */
export function SeloAtivo({ ativo, feminino = false }: { ativo: boolean; feminino?: boolean }) {
  const texto = ativo ? (feminino ? 'Ativa' : 'Ativo') : feminino ? 'Inativa' : 'Inativo';
  return <Selo tom={ativo ? 'sucesso' : 'neutro'}>{texto}</Selo>;
}

/** Selo "Geral da empresa" / "Por obra" (abrangência do tipo de documento). */
export function SeloAbrangencia({ abrangencia }: { abrangencia: Abrangencia }) {
  return (
    <Selo tom={abrangencia === 'GERAL' ? 'neutro' : 'info'} comIcone={false}>
      {TEXTO_ABRANGENCIA[abrangencia]}
    </Selo>
  );
}
