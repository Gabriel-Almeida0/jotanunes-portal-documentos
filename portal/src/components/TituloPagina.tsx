import type { ReactNode } from 'react';
import './TituloPagina.css';

interface Props {
  children: ReactNode;
  subtitulo?: ReactNode;
  id?: string;
}

/** Título de página com a barra vermelha 50×6 px da marca (docs/design.md §7). */
export function TituloPagina({ children, subtitulo, id }: Props) {
  return (
    <div className="jn-titulo-pagina">
      <span className="jn-titulo-pagina__barra" aria-hidden="true" />
      <h1 id={id} tabIndex={-1}>
        {children}
      </h1>
      {subtitulo && <p className="jn-titulo-pagina__subtitulo">{subtitulo}</p>}
    </div>
  );
}
