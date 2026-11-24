import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { listarTodasObras } from '../api/fluig';
import { useConsulta } from '../api/useConsulta';
import { CHAVE_OBRA_SELECIONADA, ContextoObraSelecionada, type ObraSelecionada } from './contexto';

function lerSalva(): string {
  try {
    return window.localStorage.getItem(CHAVE_OBRA_SELECIONADA) ?? '';
  } catch {
    return '';
  }
}

function salvar(obraId: string) {
  try {
    if (obraId) window.localStorage.setItem(CHAVE_OBRA_SELECIONADA, obraId);
    else window.localStorage.removeItem(CHAVE_OBRA_SELECIONADA);
  } catch {
    // Sem armazenamento (modo privado/iframe restrito): a seleção vale só nesta aba.
  }
}

export function ObraSelecionadaProvider({ children }: { children: ReactNode }) {
  const [obraEscolhida, setObraEscolhida] = useState(lerSalva);
  const consulta = useConsulta((sinal) => listarTodasObras(sinal), []);
  const obras = useMemo(() => consulta.dados ?? [], [consulta.dados]);

  // Obra salva que não existe mais (ou não é visível): volta para "todas" assim que a lista chega.
  const obra = obras.find((o) => o.id === obraEscolhida);
  const obraId = consulta.dados && obraEscolhida && !obra ? '' : obraEscolhida;

  const selecionar = useCallback((id: string) => {
    setObraEscolhida(id);
    salvar(id);
  }, []);

  const valor = useMemo<ObraSelecionada>(
    () => ({
      obraId,
      obra,
      obras,
      carregando: consulta.carregando && !consulta.dados,
      selecionar,
      recarregarObras: consulta.recarregar,
    }),
    [obraId, obra, obras, consulta.carregando, consulta.dados, selecionar, consulta.recarregar],
  );

  return <ContextoObraSelecionada.Provider value={valor}>{children}</ContextoObraSelecionada.Provider>;
}
