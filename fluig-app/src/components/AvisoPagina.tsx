import type { Aviso } from '../hooks/useAviso';
import { Alerta } from './Alerta';
import { SeloSituacao } from './Selo';

/** Exibe o aviso de retorno de uma ação no topo da página. */
export function AvisoPagina({ aviso, onFechar }: { aviso: Aviso | null; onFechar: () => void }) {
  if (!aviso) return null;
  return (
    <div className="jn-avisos">
      <Alerta tom={aviso.tom} onFechar={onFechar}>
        <span className="jn-aviso-pagina">
          {aviso.situacao ? <SeloSituacao situacao={aviso.situacao} /> : null}
          <span>{aviso.texto}</span>
        </span>
      </Alerta>
    </div>
  );
}
