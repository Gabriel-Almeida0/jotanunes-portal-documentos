import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ErroApi, EVENTO_NAO_AUTENTICADO, definirTokenFluig, obterTokenFluig } from '../api/client';
import { api } from '../api/fluig';
import type { OrigemSessao, SessaoJotanunes, UsuarioFluig } from '../api/tipos';
import { Carregando, EstadoErro } from '../components/Estados';
import { AcessoNegado } from '../pages/AcessoNegado';
import { Login } from '../pages/Login';
import { TrocaSenha } from '../pages/TrocaSenha';
import { ContextoSessao, ContextoUsuarioFluig, type Sessao } from './contexto';
import { descartarToken, guardarToken, lerTokenDoFragmento, lerTokenInicial, rotaDoFragmento } from './tokenFluig';

export const AVISO_SESSAO_EXPIRADA = 'Sua sessão expirou. Entre de novo.';

type Estado =
  | { tipo: 'carregando' }
  /** Sem token: consulta `GET /api/fluig/auth/configuracao` para escolher entre login e "Abra pelo Fluig". */
  | { tipo: 'semToken'; aviso: string | null }
  | { tipo: 'login'; aviso: string | null }
  | { tipo: 'negado' }
  | { tipo: 'erro'; erro: unknown; repetir: () => void }
  /** Login próprio com senha provisória: só a troca de senha, nenhuma rota do app monta. */
  | { tipo: 'trocaSenha'; usuario: UsuarioFluig }
  | { tipo: 'ok'; usuario: UsuarioFluig };

function estadoDoUsuario(usuario: UsuarioFluig): Estado {
  return usuario.trocaSenhaObrigatoria ? { tipo: 'trocaSenha', usuario } : { tipo: 'ok', usuario };
}

/**
 * Identifica o usuário da área Jotanunes (research R17, `contracts/fluig-identity.md`):
 * - token do Fluig no fragmento (`#fluigToken=`, com prioridade) ou token guardado na aba → `/me`;
 * - sem token → `GET /api/fluig/auth/configuracao`: login próprio ligado → tela de login; desligado →
 *   "Abra este sistema pelo Fluig." (sem dados nos dois casos);
 * - login próprio com senha provisória → só a troca de senha;
 * - 401 no meio da sessão: login próprio → tela de login com "Sua sessão expirou. Entre de novo.";
 *   Fluig → "Abra este sistema pelo Fluig." (a renovação é do Fluig).
 */
export function AuthFluigProvider({ children }: { children: ReactNode }) {
  const [inicial] = useState(() => lerTokenInicial());
  const [token, setToken] = useState(inicial.token);
  const [estado, setEstado] = useState<Estado>(() =>
    inicial.token ? { tipo: 'carregando' } : { tipo: 'semToken', aviso: null },
  );
  const [tentativa, setTentativa] = useState(0);
  /** Origem conhecida do token atual: fragmento → FLUIG; login → LOGIN_LOCAL; senão, a de `/me`. */
  const origemRef = useRef<OrigemSessao | null>(inicial.doFragmento ? 'FLUIG' : null);
  /** Token que já veio com o usuário (login/troca de senha): não precisa de outro `/me`. */
  const conferidoRef = useRef<string | null>(null);
  /** Durante o "Sair", o 401 de uma sessão já revogada não é "sessão expirada". */
  const saindoRef = useRef(false);
  const recadoRef = useRef<string | null>(null);

  const usarToken = useCallback((novo: string | null) => {
    if (novo) guardarToken(novo);
    else descartarToken();
    definirTokenFluig(novo);
    setToken(novo);
  }, []);

  // 401 de qualquer chamada autenticada.
  useEffect(() => {
    function naoAutenticado() {
      if (saindoRef.current || !obterTokenFluig()) return; // já tratado (várias respostas 401 juntas)
      const origem = origemRef.current;
      origemRef.current = null;
      conferidoRef.current = null;
      usarToken(null);
      setEstado(origem === 'FLUIG' ? { tipo: 'negado' } : { tipo: 'semToken', aviso: AVISO_SESSAO_EXPIRADA });
    }
    window.addEventListener(EVENTO_NAO_AUTENTICADO, naoAutenticado);
    return () => window.removeEventListener(EVENTO_NAO_AUTENTICADO, naoAutenticado);
  }, [usarToken]);

  // Token entregue (ou renovado) pelo Fluig trocando só o fragmento, sem recarregar a página. Tem
  // prioridade: substitui uma sessão de login próprio na mesma aba.
  useEffect(() => {
    let ultimaRota = rotaDoFragmento();
    function aoMudarFragmento() {
      const novo = lerTokenDoFragmento(ultimaRota);
      const rota = rotaDoFragmento();
      if (rota !== null) ultimaRota = rota;
      if (novo === null) return;
      origemRef.current = 'FLUIG';
      conferidoRef.current = null;
      usarToken(novo);
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
  }, [usarToken]);

  // Com token: confere em `/me` quem é (e a origem).
  useEffect(() => {
    definirTokenFluig(token);
    if (!token || token === conferidoRef.current) return;
    const controle = new AbortController();
    // Renovação com o app já aberto: confere o token novo sem desmontar a tela (mantém rota e estado).
    setEstado((atual) => (atual.tipo === 'ok' ? atual : { tipo: 'carregando' }));
    api
      .me(controle.signal)
      .then((usuario) => {
        origemRef.current = usuario.origem;
        setEstado(estadoDoUsuario(usuario));
      })
      .catch((erro: unknown) => {
        if (controle.signal.aborted) return;
        if (erro instanceof ErroApi && erro.status === 401) return; // tratado pelo evento
        setEstado((atual) =>
          atual.tipo === 'ok' ? atual : { tipo: 'erro', erro, repetir: () => setTentativa((t) => t + 1) },
        );
      });
    return () => controle.abort();
  }, [token, tentativa]);

  // Sem token: a API diz se o login próprio está ligado.
  useEffect(() => {
    if (estado.tipo !== 'semToken') return;
    const { aviso } = estado;
    const controle = new AbortController();
    api
      .configuracaoAcesso(controle.signal)
      .then((c) => setEstado(c.loginLocalHabilitado ? { tipo: 'login', aviso } : { tipo: 'negado' }))
      .catch((erro: unknown) => {
        if (controle.signal.aborted) return;
        setEstado({ tipo: 'erro', erro, repetir: () => setEstado({ tipo: 'semToken', aviso }) });
      });
    return () => controle.abort();
  }, [estado]);

  const abrirSessaoLocal = useCallback(
    (sessao: SessaoJotanunes) => {
      origemRef.current = 'LOGIN_LOCAL';
      conferidoRef.current = sessao.accessToken;
      usarToken(sessao.accessToken);
      setEstado(estadoDoUsuario(sessao.usuario));
    },
    [usarToken],
  );

  const sessao = useMemo<Sessao>(
    () => ({
      origem: estado.tipo === 'ok' || estado.tipo === 'trocaSenha' ? estado.usuario.origem : null,
      entrar: abrirSessaoLocal,
      atualizarToken: (nova, recado) => {
        recadoRef.current = recado ?? null;
        // Depois da troca obrigatória, o app abre no painel (e não na rota digitada antes da troca).
        if (estado.tipo === 'trocaSenha') {
          const { pathname, search } = window.location;
          window.history.replaceState(window.history.state, '', `${pathname}${search}#/`);
        }
        abrirSessaoLocal(nova);
      },
      sair: async (aviso) => {
        saindoRef.current = true;
        try {
          await api.sair();
        } catch {
          // Mesmo sem resposta da API, o token some deste navegador.
        } finally {
          saindoRef.current = false;
        }
        origemRef.current = null;
        conferidoRef.current = null;
        usarToken(null);
        setEstado({ tipo: 'semToken', aviso: aviso ?? null });
      },
      consumirRecado: () => {
        const recado = recadoRef.current;
        recadoRef.current = null;
        return recado;
      },
    }),
    [estado, abrirSessaoLocal, usarToken],
  );

  let conteudo: ReactNode;
  if (estado.tipo === 'negado') conteudo = <AcessoNegado />;
  else if (estado.tipo === 'login') conteudo = <Login aviso={estado.aviso} />;
  else if (estado.tipo === 'trocaSenha') conteudo = <TrocaSenha modo="obrigatorio" />;
  else if (estado.tipo === 'erro') {
    conteudo = (
      <div className="jn-app jn-app--centro">
        <EstadoErro erro={estado.erro} onTentarDeNovo={estado.repetir} />
      </div>
    );
  } else if (estado.tipo === 'ok') {
    conteudo = <ContextoUsuarioFluig.Provider value={estado.usuario}>{children}</ContextoUsuarioFluig.Provider>;
  } else {
    conteudo = (
      <div className="jn-app jn-app--centro">
        <Carregando texto="Conferindo seu acesso…" />
      </div>
    );
  }

  const usuarioTroca = estado.tipo === 'trocaSenha' ? estado.usuario : null;
  return (
    <ContextoSessao.Provider value={sessao}>
      {usuarioTroca ? (
        <ContextoUsuarioFluig.Provider value={usuarioTroca}>{conteudo}</ContextoUsuarioFluig.Provider>
      ) : (
        conteudo
      )}
    </ContextoSessao.Provider>
  );
}
