import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Situacao } from '../components/Selo';

/** Só dados simples: o aviso pode viajar no `history.state` (precisa ser clonável). */
export interface Aviso {
  tom: 'sucesso' | 'erro' | 'info';
  texto: string;
  /** Exibe o selo da situação junto do texto (ex.: após aprovar/rejeitar). */
  situacao?: Situacao;
}

/**
 * Mensagem de retorno de uma ação (ex.: "Obra cadastrada."). Some sozinha depois de alguns
 * segundos. Também lê um aviso passado pela navegação (`navigate(rota, { state: { aviso } })`).
 */
export function useAviso(duracaoMs = 8000) {
  const location = useLocation();
  const navigate = useNavigate();
  const doEstado = (location.state as { aviso?: Aviso } | null)?.aviso ?? null;
  const [aviso, setAviso] = useState<Aviso | null>(doEstado);
  const timer = useRef<number>();

  // Limpa o state da navegação para o aviso não voltar ao recarregar.
  useEffect(() => {
    if (doEstado) navigate(location.pathname + location.search, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (aviso && aviso.tom !== 'erro') {
      timer.current = window.setTimeout(() => setAviso(null), duracaoMs);
    }
    return () => window.clearTimeout(timer.current);
  }, [aviso, duracaoMs]);

  const mostrar = useCallback((novo: Aviso | null) => setAviso(novo), []);
  return [aviso, mostrar] as const;
}
