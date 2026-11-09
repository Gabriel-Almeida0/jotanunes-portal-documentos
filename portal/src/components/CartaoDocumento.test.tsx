import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentoSituacaoPortal } from '../api/tipos';
import { CartaoDocumento } from './CartaoDocumento';

const HOJE = new Date('2026-10-26T15:00:00Z');

const FGTS: DocumentoSituacaoPortal['tipoDocumento'] = {
  id: '00000000-0000-4000-8000-000000000104',
  nome: 'Guia do FGTS',
  instrucoes: null,
  abrangencia: 'GERAL',
  periodicidade: {
    unidade: 'MESES',
    intervalo: 1,
    prazoDias: 15,
    descricao: 'Mensal · até o dia 15 do mês seguinte',
  },
};

function periodico(extras: Partial<DocumentoSituacaoPortal> = {}): DocumentoSituacaoPortal {
  return {
    tipoDocumento: FGTS,
    situacao: 'PENDENTE_ENVIO',
    envioAtual: null,
    podeEnviar: true,
    atrasado: true,
    periodos: {
      atrasados: 2,
      pendentes: 1,
      rejeitados: 1,
      emAnalise: 1,
      aprovados: 0,
      proximo: {
        inicio: '2026-08-01',
        fim: '2026-08-31',
        prazo: '2026-09-15',
        rotulo: 'Agosto/2026',
      },
    },
    ...extras,
  };
}

function renderizar(documento: DocumentoSituacaoPortal, obraId: string | null = null) {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CartaoDocumento
        documento={documento}
        obraId={obraId}
        linkHistorico="/documentos/x"
        aoEnviar={() => {}}
        aoDesatualizar={() => {}}
      />
    </MemoryRouter>,
  );
  return within(screen.getByRole('article', { name: documento.tipoDocumento.nome }));
}

describe('CartaoDocumento (periódico)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: HOJE });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra a periodicidade, o resumo dos períodos e o próximo período com prazo vencido', () => {
    const cartao = renderizar(periodico());
    expect(cartao.getByText('Mensal · até o dia 15 do mês seguinte')).toBeInTheDocument();
    expect(cartao.getByText('2 atrasados · 1 em análise')).toBeInTheDocument();
    expect(
      cartao.getByText('Próximo: Agosto/2026 · prazo venceu em 15/09/2026'),
    ).toBeInTheDocument();
    // Selo "Atrasado" com texto (não só cor).
    expect(cartao.getByText('Atrasado')).toBeInTheDocument();
  });

  it('não tem envio direto: o botão "Ver períodos" leva à página de períodos do contexto', () => {
    const cartao = renderizar(periodico(), 'obra-1');
    expect(cartao.queryByRole('button', { name: /Enviar/ })).not.toBeInTheDocument();
    expect(cartao.getByRole('link', { name: 'Ver períodos de Guia do FGTS' })).toHaveAttribute(
      'href',
      `/obras/obra-1/documentos/${FGTS.id}/periodos`,
    );
  });

  it('próximo período dentro do prazo mostra "até" a data', () => {
    const cartao = renderizar(
      periodico({
        atrasado: false,
        periodos: {
          atrasados: 0,
          pendentes: 1,
          rejeitados: 0,
          emAnalise: 0,
          aprovados: 0,
          proximo: {
            inicio: '2026-10-01',
            fim: '2026-10-31',
            prazo: '2026-11-15',
            rotulo: 'Outubro/2026',
          },
        },
      }),
    );
    expect(cartao.getByText('Próximo: Outubro/2026 · até 15/11/2026')).toBeInTheDocument();
    expect(cartao.getByText('1 a enviar')).toBeInTheDocument();
    expect(cartao.getByText('Pendente de envio')).toBeInTheDocument();
    expect(cartao.queryByText('Atrasado')).not.toBeInTheDocument();
  });

  it('sem período pendente: avisa que não há nada a enviar agora', () => {
    const cartao = renderizar(
      periodico({
        situacao: 'APROVADO',
        podeEnviar: false,
        atrasado: false,
        periodos: {
          atrasados: 0,
          pendentes: 0,
          rejeitados: 0,
          emAnalise: 0,
          aprovados: 3,
          proximo: null,
        },
      }),
    );
    expect(cartao.getByText('3 aprovados')).toBeInTheDocument();
    expect(cartao.getByText('Nenhum período para enviar agora.')).toBeInTheDocument();
  });

  it('documento único continua com envio direto e sem "Ver períodos"', () => {
    const cartao = renderizar({
      tipoDocumento: {
        ...FGTS,
        nome: 'Cartão CNPJ',
        periodicidade: { unidade: 'UNICA', intervalo: null, prazoDias: null, descricao: 'Único' },
      },
      situacao: 'PENDENTE_ENVIO',
      envioAtual: null,
      podeEnviar: true,
      atrasado: false,
      periodos: null,
    });
    expect(cartao.getByRole('button', { name: 'Enviar documento' })).toBeInTheDocument();
    expect(cartao.queryByRole('link', { name: /Ver períodos/ })).not.toBeInTheDocument();
    expect(cartao.queryByText('Único')).not.toBeInTheDocument();
  });
});
