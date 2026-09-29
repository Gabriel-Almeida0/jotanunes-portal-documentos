import { Botao } from './Botao';
import './Paginacao.css';

export interface PaginacaoProps {
  pagina: number;
  tamanhoPagina: number;
  total: number;
  onMudar: (pagina: number) => void;
  /** Ex.: "empresas". */
  rotuloItens?: string;
}

export function Paginacao({ pagina, tamanhoPagina, total, onMudar, rotuloItens = 'itens' }: PaginacaoProps) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanhoPagina));
  const inicio = total === 0 ? 0 : (pagina - 1) * tamanhoPagina + 1;
  const fim = Math.min(total, pagina * tamanhoPagina);
  return (
    <nav className="jn-paginacao" aria-label="Paginação">
      <p className="jn-paginacao__info" aria-live="polite">
        {total === 0
          ? `Nenhum ${rotuloItens === 'itens' ? 'item' : 'resultado'}`
          : `Mostrando ${inicio}–${fim} de ${total} ${rotuloItens}`}
      </p>
      {totalPaginas > 1 ? (
        <div className="jn-paginacao__botoes">
          <Botao variante="fantasma" tamanho="pequeno" disabled={pagina <= 1} onClick={() => onMudar(pagina - 1)}>
            Anterior
          </Botao>
          <span className="jn-paginacao__atual">
            Página {pagina} de {totalPaginas}
          </span>
          <Botao
            variante="fantasma"
            tamanho="pequeno"
            disabled={pagina >= totalPaginas}
            onClick={() => onMudar(pagina + 1)}
          >
            Próxima
          </Botao>
        </div>
      ) : null}
    </nav>
  );
}
