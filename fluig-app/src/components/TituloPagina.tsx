import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconeVoltar } from './icons';
import './TituloPagina.css';

export interface TituloPaginaProps {
  titulo: ReactNode;
  descricao?: ReactNode;
  /** Botões à direita do título. */
  acoes?: ReactNode;
  voltar?: { para: string; rotulo: string };
  /** Conteúdo abaixo do título (ex.: selos, metadados). */
  children?: ReactNode;
}

/** Título de página com a barra vermelha de 50×6 px da marca (docs/design.md §7). */
export function TituloPagina({ titulo, descricao, acoes, voltar, children }: TituloPaginaProps) {
  return (
    <header className="jn-titulo-pagina">
      {voltar ? (
        <Link className="jn-titulo-pagina__voltar" to={voltar.para}>
          <IconeVoltar tamanho={16} /> {voltar.rotulo}
        </Link>
      ) : null}
      <div className="jn-titulo-pagina__linha">
        <div className="jn-titulo-pagina__textos">
          <span className="jn-titulo-pagina__barra" aria-hidden="true" />
          <h1 className="jn-titulo-pagina__h1">{titulo}</h1>
          {descricao ? <p className="jn-titulo-pagina__descricao">{descricao}</p> : null}
        </div>
        {acoes ? <div className="jn-titulo-pagina__acoes">{acoes}</div> : null}
      </div>
      {children ? <div className="jn-titulo-pagina__extra">{children}</div> : null}
    </header>
  );
}
