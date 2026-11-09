import type { ContagemDocumentos } from '../api/tipos';
import './ResumoDocumentos.css';

/**
 * "X de Y aprovados" + barra de progresso + detalhamento em texto (nunca só cor). `rotulo` identifica
 * o contexto quando há mais de uma contagem (ex.: "Documentos desta obra", "Gerais").
 */
export function ResumoDocumentos({
  contagem,
  compacto = false,
  rotulo,
}: {
  contagem: ContagemDocumentos;
  compacto?: boolean;
  rotulo?: string;
}) {
  const { total, aprovados, emAnalise, pendentes, rejeitados } = contagem;
  const atrasados = contagem.periodosAtrasados ?? 0;
  /** 003: períodos atrasados vêm à parte (o documento conta uma vez nas demais contagens). */
  const textoAtrasados = atrasados
    ? `${atrasados} ${atrasados === 1 ? 'período atrasado' : 'períodos atrasados'}`
    : null;
  const pct = total === 0 ? 0 : Math.round((aprovados / total) * 100);
  const partes = [
    pendentes ? `${pendentes} pendente${pendentes > 1 ? 's' : ''}` : null,
    emAnalise ? `${emAnalise} em análise` : null,
    rejeitados ? `${rejeitados} rejeitado${rejeitados > 1 ? 's' : ''}` : null,
  ].filter(Boolean);
  const progresso = total === 0 ? 'nenhum documento exigido' : `${aprovados} de ${total} aprovados`;
  const principal = rotulo ? `${rotulo}: ${progresso}` : progresso.charAt(0).toUpperCase() + progresso.slice(1);
  return (
    <div className="jn-resumo-docs">
      <span className="jn-resumo-docs__principal">
        {principal}
      </span>
      {total > 0 ? (
        <span className="jn-resumo-docs__barra" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
      ) : null}
      {!compacto && partes.length > 0 ? <span className="jn-resumo-docs__detalhe">{partes.join(' · ')}</span> : null}
      {textoAtrasados ? <span className="jn-resumo-docs__atrasados">{textoAtrasados}</span> : null}
    </div>
  );
}
