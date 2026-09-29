import type { ContagemDocumentos } from '../api/tipos';
import './ResumoDocumentos.css';

/** "X de Y aprovados" + barra de progresso + detalhamento em texto (nunca só cor). */
export function ResumoDocumentos({ contagem, compacto = false }: { contagem: ContagemDocumentos; compacto?: boolean }) {
  const { total, aprovados, emAnalise, pendentes, rejeitados } = contagem;
  const pct = total === 0 ? 0 : Math.round((aprovados / total) * 100);
  const partes = [
    pendentes ? `${pendentes} pendente${pendentes > 1 ? 's' : ''}` : null,
    emAnalise ? `${emAnalise} em análise` : null,
    rejeitados ? `${rejeitados} rejeitado${rejeitados > 1 ? 's' : ''}` : null,
  ].filter(Boolean);
  return (
    <div className="jn-resumo-docs">
      <span className="jn-resumo-docs__principal">
        {total === 0 ? 'Nenhum documento exigido' : `${aprovados} de ${total} aprovados`}
      </span>
      {total > 0 ? (
        <span className="jn-resumo-docs__barra" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
      ) : null}
      {!compacto && partes.length > 0 ? <span className="jn-resumo-docs__detalhe">{partes.join(' · ')}</span> : null}
    </div>
  );
}
