import { useEffect, useState, type ReactNode } from 'react';
import { ErroApi, EVENTO_NAO_AUTENTICADO, definirTokenFluig } from '../api/client';
import { api } from '../api/fluig';
import type { UsuarioFluig } from '../api/tipos';
import { Carregando, EstadoErro } from '../components/Estados';
import { AcessoNegado } from '../pages/AcessoNegado';
import { ContextoUsuarioFluig } from './contexto';
import { descartarToken, guardarToken, lerTokenDoFragmento, obterTokenInicial, rotaDoFragmento } from './tokenFluig';

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
  const [token, setToken] = useState(() => obterTokenInicial());
  const [estado, setEstado] = useState<Estado>(() => (token ? { tipo: 'carregando' } : { tipo: 'negado' }));
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    function negar() {
      descartarToken();
      definirTokenFluig(null);
      setEstado({ tipo: 'negado' });
    }
    window.addEventListener(EVENTO_NAO_AUTENTICADO, negar);
    return () => window.removeEventListener(EVENTO_NAO_AUTENTICADO, negar);
  }, []);

  // Token entregue (ou renovado) pelo Fluig trocando só o fragmento, sem recarregar a página.
  useEffect(() => {
    let ultimaRota = rotaDoFragmento();
    function aoMudarFragmento() {
      const novo = lerTokenDoFragmento(ultimaRota);
      const rota = rotaDoFragmento();
      if (rota !== null) ultimaRota = rota;
      if (novo === null) return;
      guardarToken(novo);
      definirTokenFluig(novo);
      setToken(novo);
      setTentativa((t) => t + 1);
      // replaceState não gera evento: avisa o HashRouter de que a URL foi limpa.
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    }
    // O navegador dispara `popstate` e depois `hashchange`; o primeiro que achar o token limpa a URL.
    window.addEventListener('popstate', aoMudarFragmento);
    window.addEventListener('hashchange', aoMudarFragmento);
    return () => {
      window.removeEventListener('popstate', aoMudarFragmento);
      window.removeEventListener('hashchange', aoMudarFragmento);
    };
  }, []);

  useEffect(() => {
    definirTokenFluig(token);
    if (!token) return;
    const controle = new AbortController();
    // Renovação com o app já aberto: confere o token novo sem desmontar a tela (mantém rota e estado).
    setEstado((atual) => (atual.tipo === 'ok' ? atual : { tipo: 'carregando' }));
    api
      .me(controle.signal)
      .then((usuario) => setEstado({ tipo: 'ok', usuario }))
      .catch((erro: unknown) => {
        if (controle.signal.aborted) return;
        if (erro instanceof ErroApi && erro.status === 401) setEstado({ tipo: 'negado' });
        else setEstado((atual) => (atual.tipo === 'ok' ? atual : { tipo: 'erro', erro }));
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
