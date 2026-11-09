import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import './Abas.css';

export interface Aba {
  id: string;
  rotulo: ReactNode;
  /** Conteúdo do painel; só o da aba ativa é renderizado. */
  conteudo: ReactNode;
}

export interface AbasProps {
  /** Nome acessível da lista de abas. */
  rotulo: string;
  abas: Aba[];
  ativa: string;
  onTrocar: (id: string) => void;
}

/**
 * Abas no padrão WAI-ARIA (tablist/tab/tabpanel, ativação automática): ←/→ trocam de aba,
 * Home/End vão para a primeira/última, só a aba ativa entra na ordem de tabulação.
 */
export function Abas({ rotulo, abas, ativa, onTrocar }: AbasProps) {
  const base = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const atual = abas.find((a) => a.id === ativa) ?? abas[0];
  const idAba = (id: string) => `${base}-aba-${id}`;
  const idPainel = (id: string) => `${base}-painel-${id}`;

  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    const i = abas.findIndex((a) => a.id === atual?.id);
    let destino: number | null = null;
    if (e.key === 'ArrowRight') destino = (i + 1) % abas.length;
    else if (e.key === 'ArrowLeft') destino = (i - 1 + abas.length) % abas.length;
    else if (e.key === 'Home') destino = 0;
    else if (e.key === 'End') destino = abas.length - 1;
    if (destino === null) return;
    e.preventDefault();
    const proxima = abas[destino];
    onTrocar(proxima.id);
    refs.current[proxima.id]?.focus();
  }

  if (!atual) return null;
  return (
    <div className="jn-abas">
      <div className="jn-abas__lista" role="tablist" aria-label={rotulo} onKeyDown={aoTeclar}>
        {abas.map((a) => {
          const selecionada = a.id === atual.id;
          return (
            <button
              key={a.id}
              ref={(el) => {
                refs.current[a.id] = el;
              }}
              type="button"
              role="tab"
              id={idAba(a.id)}
              className="jn-abas__aba"
              aria-selected={selecionada}
              aria-controls={idPainel(a.id)}
              tabIndex={selecionada ? 0 : -1}
              onClick={() => onTrocar(a.id)}
            >
              {a.rotulo}
            </button>
          );
        })}
      </div>
      <div
        className="jn-abas__painel"
        role="tabpanel"
        id={idPainel(atual.id)}
        aria-labelledby={idAba(atual.id)}
        tabIndex={0}
      >
        {atual.conteudo}
      </div>
    </div>
  );
}
