import { useCallback, useEffect, useRef, useState } from 'react';

export interface EstadoConsulta<T> {
  dados: T | undefined;
  carregando: boolean;
  erro: unknown;
  recarregar: () => void;
  /** Substitui os dados localmente (ex.: após salvar), sem nova requisição. */
  definirDados: (dados: T) => void;
}

/**
 * Carrega dados assíncronos com estados de carregamento/erro, cancelando a requisição anterior
 * quando as dependências mudam.
 */
export function useConsulta<T>(
  buscar: (sinal: AbortSignal) => Promise<T>,
  dependencias: readonly unknown[],
): EstadoConsulta<T> {
  const [dados, setDados] = useState<T | undefined>(undefined);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<unknown>(null);
  const [versao, setVersao] = useState(0);
  const buscarRef = useRef(buscar);
  buscarRef.current = buscar;

  useEffect(() => {
    const controle = new AbortController();
    setCarregando(true);
    setErro(null);
    buscarRef
      .current(controle.signal)
      .then((resultado) => {
        if (!controle.signal.aborted) setDados(resultado);
      })
      .catch((e: unknown) => {
        if (controle.signal.aborted) return;
        setErro(e);
      })
      .finally(() => {
        if (!controle.signal.aborted) setCarregando(false);
      });
    return () => controle.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, versao]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  const definirDados = useCallback((novo: T) => setDados(novo), []);

  return { dados, carregando, erro, recarregar, definirDados };
}
