import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { Rotas } from '../App';
import { api } from '../api/client';
import type { SessaoPortal } from '../api/tipos';
import { guardarSessao } from '../auth/armazenamento';

function RotaAtual() {
  const local = useLocation();
  return (
    <output data-testid="rota-atual" data-busca={local.search} hidden>
      {local.pathname}
    </output>
  );
}

/** Renderiza o portal inteiro (rotas reais + MSW) começando na rota indicada. */
export function renderizarPortal(rota = '/') {
  // applyAccept: false → deixa o componente validar arquivos fora do `accept` (ex.: .exe).
  const user = userEvent.setup({ applyAccept: false });
  const resultado = render(
    <MemoryRouter
      initialEntries={[rota]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Rotas />
      <RotaAtual />
    </MemoryRouter>,
  );
  return { user, ...resultado };
}

export function rotaAtual(): string {
  return document.querySelector('[data-testid="rota-atual"]')?.textContent ?? '';
}

/** Query string atual do roteador (ex.: `?x=1`; vazia quando não há). */
export function buscaAtual(): string {
  return document.querySelector('[data-testid="rota-atual"]')?.getAttribute('data-busca') ?? '';
}

/** Faz login no mock e guarda a sessão como se a empresa já estivesse conectada. */
export async function conectarComo(cnpj: string, senha: string): Promise<SessaoPortal> {
  const sessao = await api.login({ cnpj, senha });
  guardarSessao(sessao);
  return sessao;
}

export const EMPRESA_ALFA = { cnpj: '11222333000181', senha: 'Alfa2026ok' };
export const EMPRESA_DELTA = { cnpj: '99888777000100', senha: 'Delta2026ok' };

/** Arquivo PDF válido (assinatura `%PDF-`) com o tamanho pedido. */
export function arquivoPdf(nome = 'documento.pdf', tamanho = 64): File {
  const cabecalho = new TextEncoder().encode('%PDF-1.4\n');
  const bytes = new Uint8Array(Math.max(tamanho, cabecalho.length)).fill(32);
  bytes.set(cabecalho);
  return new File([bytes], nome, { type: 'application/pdf' });
}
