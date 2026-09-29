import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, configurarCliente } from '../api/client';
import { MENSAGENS, MENSAGEM_SESSAO_EXPIRADA_NO_ENVIO } from '../api/mensagens';
import type { SessaoPortal } from '../api/tipos';
import { guardarSessao, lerSessaoGuardada } from './armazenamento';
import { ContextoSessao, type ValorSessao } from './contexto';

export function SessaoProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [sessao, setSessao] = useState<SessaoPortal | null>(() => lerSessaoGuardada());
  const [aviso, setAviso] = useState<string | null>(null);
  const recado = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(sessao?.accessToken ?? null);

  const definirSessao = useCallback((nova: SessaoPortal | null) => {
    tokenRef.current = nova?.accessToken ?? null;
    guardarSessao(nova);
    setSessao(nova);
  }, []);

  const entrar = useCallback(
    (nova: SessaoPortal) => {
      setAviso(null);
      definirSessao(nova);
    },
    [definirSessao],
  );

  const sair = useCallback(
    (mensagem?: string) => {
      definirSessao(null);
      setAviso(mensagem ?? null);
      navigate('/acesso', { replace: true });
    },
    [definirSessao, navigate],
  );

  // Liga o cliente HTTP à sessão: token, sessão expirada (401) e troca obrigatória (403).
  // Feito já na primeira renderização (não em efeito): os efeitos dos filhos rodam antes dos do
  // provider, e a primeira chamada da página precisa sair com o token restaurado.
  const tratadores = useRef({ sair, navigate });
  tratadores.current = { sair, navigate };
  useState(() =>
    configurarCliente({
      obterToken: () => tokenRef.current,
      aoNaoAutenticado: (contexto) =>
        tratadores.current.sair(
          contexto === 'envio' ? MENSAGEM_SESSAO_EXPIRADA_NO_ENVIO : MENSAGENS.NAO_AUTENTICADO,
        ),
      aoTrocaSenhaObrigatoria: () => {
        setSessao((atual) => {
          if (!atual) return atual;
          const nova = { ...atual, empresa: { ...atual.empresa, trocaSenhaObrigatoria: true } };
          guardarSessao(nova);
          return nova;
        });
        tratadores.current.navigate('/trocar-senha', { replace: true });
      },
    }),
  );

  // Encerra a sessão quando o token vence (8 h), mesmo sem nenhuma chamada à API.
  useEffect(() => {
    if (!sessao) return;
    const restante = new Date(sessao.expiraEm).getTime() - Date.now();
    if (restante > 2_147_483_647) return;
    const id = window.setTimeout(() => sair(MENSAGENS.NAO_AUTENTICADO), Math.max(restante, 0));
    return () => window.clearTimeout(id);
  }, [sessao, sair]);

  // Sessão restaurada do sessionStorage: confere na API se ainda vale e atualiza a empresa.
  const conferida = useRef(false);
  useEffect(() => {
    if (conferida.current || !sessao) return;
    conferida.current = true;
    api
      .empresaAtual()
      .then((empresa) =>
        setSessao((atual) => {
          if (!atual) return atual;
          const nova = { ...atual, empresa };
          guardarSessao(nova);
          return nova;
        }),
      )
      .catch(() => {
        // 401 já é tratado pelo cliente; falha de rede mantém a sessão local.
      });
  }, [sessao]);

  const valor = useMemo<ValorSessao>(
    () => ({
      sessao,
      empresa: sessao?.empresa ?? null,
      trocaSenhaObrigatoria: sessao?.empresa.trocaSenhaObrigatoria ?? false,
      aviso,
      entrar,
      atualizar: entrar,
      sair,
      limparAviso: () => setAviso(null),
      deixarRecado: (texto: string) => {
        recado.current = texto;
      },
      pegarRecado: () => {
        const texto = recado.current;
        recado.current = null;
        return texto;
      },
    }),
    [sessao, aviso, entrar, sair],
  );

  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>;
}
