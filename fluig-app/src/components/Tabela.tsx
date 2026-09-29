import type { ReactNode } from 'react';
import './Tabela.css';

export interface TabelaProps {
  /** Nome acessível da tabela (lido por leitores de tela). */
  rotulo: string;
  children: ReactNode;
  className?: string;
}

/**
 * Tabela densa com rolagem horizontal interna: a página nunca rola para o lado, só a tabela.
 * A região é focável para permitir rolar pelo teclado.
 */
export function Tabela({ rotulo, children, className }: TabelaProps) {
  return (
    <div className="jn-tabela-rolagem" role="region" aria-label={rotulo} tabIndex={0}>
      <table className={`jn-tabela ${className ?? ''}`.trim()}>
        <caption className="jn-sr-only">{rotulo}</caption>
        {children}
      </table>
    </div>
  );
}
