import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSessao } from './contexto';

interface Props {
  children: ReactNode;
  /** `true` só na tela de troca de senha: é a única liberada com a troca pendente. */
  paraTrocaDeSenha?: boolean;
}

/**
 * Sem sessão → `/acesso`. Com troca de senha pendente → `/trocar-senha` (nenhuma outra tela).
 * A tela de troca, sem troca pendente, leva para `/documentos`.
 */
export function RotaProtegida({ children, paraTrocaDeSenha = false }: Props) {
  const { sessao, trocaSenhaObrigatoria } = useSessao();
  const local = useLocation();

  if (!sessao) return <Navigate to="/acesso" replace state={{ de: local.pathname }} />;
  if (trocaSenhaObrigatoria && !paraTrocaDeSenha) return <Navigate to="/trocar-senha" replace />;
  if (!trocaSenhaObrigatoria && paraTrocaDeSenha) return <Navigate to="/documentos" replace />;
  return <>{children}</>;
}
