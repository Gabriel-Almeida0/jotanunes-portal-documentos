import { useEffect, useState, type ReactNode } from 'react';
import { ErroApi, EVENTO_NAO_AUTENTICADO, definirTokenFluig } from '../api/client';
import { api } from '../api/fluig';
import type { UsuarioFluig } from '../api/tipos';
import { Carregando, EstadoErro } from '../components/Estados';
import { AcessoNegado } from '../pages/AcessoNegado';
import { ContextoUsuarioFluig } from './contexto';
import { descartarToken, obterTokenInicial } from './tokenFluig';


type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'negado' }
  | { tipo: 'erro'; erro: unknown }
  | { tipo: 'ok'; usuario: UsuarioFluig };

/**
 * Identifica o usuário pelo token do Fluig. Sem token, ou com token recusado (401), mostra apenas
 * "Abra este sistema pelo Fluig." — nenhum dado é carregado.
 */
export function AuthFluigProvider({ children }: { children: ReactNode }) {
  const [token] = useState(() => obterTokenInicial());
  const [estado, setEstado] = useState<Estado>(() => (token ? { tipo: 'carregando' } : { tipo: 'negado' }));
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    definirTokenFluig(token);
    function negar() {
      descartarToken();
      definirTokenFluig(null);
      setEstado({ tipo: 'negado' });
    }
    window.addEventListener(EVENTO_NAO_AUTENTICADO, negar);
    return () => window.removeEventListener(EVENTO_NAO_AUTENTICADO, negar);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const controle = new AbortController();
    setEstado({ tipo: 'carregando' });
    api
      .me(controle.signal)
      .then((usuario) => setEstado({ tipo: 'ok', usuario }))
      .catch((erro: unknown) => {
        if (controle.signal.aborted) return;
        if (erro instanceof ErroApi && erro.status === 401) setEstado({ tipo: 'negado' });
        else setEstado({ tipo: 'erro', erro });
      });
    return () => controle.abort();
  }, [token, tentativa]);

  if (estado.tipo === 'negado') return <AcessoNegado />;
  if (estado.tipo === 'carregando') {
    return (
      <div className="jn-app jn-app--centro">
        <Carregando texto="Conferindo seu acesso…" />
      </div>
    );
  }
  if (estado.tipo === 'erro') {
    return (
      <div className="jn-app jn-app--centro">
        <EstadoErro erro={estado.erro} onTentarDeNovo={() => setTentativa((t) => t + 1)} />
      </div>
    );
  }
  return <ContextoUsuarioFluig.Provider value={estado.usuario}>{children}</ContextoUsuarioFluig.Provider>;
}
