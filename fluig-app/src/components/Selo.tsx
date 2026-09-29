import type { ReactNode } from 'react';
import { IconeAlerta, IconeCirculo, IconeCirculoCheck, IconeCirculoX, IconeRelogio } from './icons';
import { SITUACOES, type Situacao, type TomSelo } from './situacoes';
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

/** Selo "Ativo/Inativo" (ou "Ativa/Inativa") para cadastros. */
export function SeloAtivo({ ativo, feminino = false }: { ativo: boolean; feminino?: boolean }) {
  const texto = ativo ? (feminino ? 'Ativa' : 'Ativo') : feminino ? 'Inativa' : 'Inativo';
  return <Selo tom={ativo ? 'sucesso' : 'neutro'}>{texto}</Selo>;
}
