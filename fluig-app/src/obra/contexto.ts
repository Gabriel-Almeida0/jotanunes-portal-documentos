import { createContext, useContext } from 'react';
import type { ObraResumo } from '../api/tipos';

/** Chave do `localStorage`: a obra escolhida continua selecionada ao reabrir o app. */
export const CHAVE_OBRA_SELECIONADA = 'jn-obra-selecionada';

/**
 * Filtro geral do sistema por obra. Quando há obra selecionada, as abas que mostram dados de
 * empresas e documentos (Painel, Empresas, Fila de análise) passam a mostrar só o que é das
 * empresas vinculadas a ela. `obraId === ''` = todas as obras.
 *
 * Tipos de documento e Usuários são cadastros globais (todo tipo ativo vale para toda empresa) e
 * não são recortados.
 */
export interface ObraSelecionada {
  /** Id da obra selecionada, ou `''` para todas. */
  obraId: string;
  /** Dados da obra selecionada (quando a lista já carregou). */
  obra: ObraResumo | undefined;
  /** Todas as obras (ativas e inativas), para o seletor. */
  obras: ObraResumo[];
  carregando: boolean;
  selecionar: (obraId: string) => void;
  /** Recarrega a lista do seletor (depois de cadastrar/editar/ativar uma obra). */
  recarregarObras: () => void;
}

const SEM_FILTRO: ObraSelecionada = {
  obraId: '',
  obra: undefined,
  obras: [],
  carregando: false,
  selecionar: () => undefined,
  recarregarObras: () => undefined,
};

export const ContextoObraSelecionada = createContext<ObraSelecionada>(SEM_FILTRO);

/** Fora do provider (ex.: teste de um componente isolado) não há filtro: todas as obras. */
export function useObraSelecionada(): ObraSelecionada {
  return useContext(ContextoObraSelecionada);
}
