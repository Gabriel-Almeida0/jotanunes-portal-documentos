import type { ObraPortal } from '../api/tipos';
import { IconePin } from './icons';
import './ContextoObra.css';

/**
 * Faixa fixa no topo com a obra em que a pessoa está (FR-251): fica visível enquanto rola a lista,
 * no envio e no histórico, para não mandar o arquivo para a obra errada.
 */
export function ContextoObra({ obra }: { obra: Pick<ObraPortal, 'nome' | 'cidade' | 'uf'> }) {
  return (
    <p className="jn-contexto-obra" data-testid="contexto-obra">
      <IconePin tamanho={16} className="jn-contexto-obra__pin" />
      <span>
        Obra: <strong>{obra.nome}</strong>
        <span className="jn-contexto-obra__local">
          {' '}
          · {obra.cidade}/{obra.uf}
        </span>
      </span>
    </p>
  );
}
