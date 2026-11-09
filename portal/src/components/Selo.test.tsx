import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SituacaoDocumento } from '../api/tipos';
import { Selo } from './Selo';

describe('Selo', () => {
  it.each<[SituacaoDocumento, string]>([
    ['PENDENTE_ENVIO', 'Pendente de envio'],
    ['EM_ANALISE', 'Em análise'],
    ['APROVADO', 'Aprovado'],
    ['REJEITADO', 'Rejeitado'],
  ])('mostra a situação %s sempre com texto', (situacao, texto) => {
    const { container } = render(<Selo situacao={situacao} />);
    expect(screen.getByText(texto)).toBeInTheDocument();
    // O ícone é decorativo: a informação não depende da cor nem do ícone.
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('atrasado sem envio mostra só "Atrasado" (texto e ícone)', () => {
    const { container } = render(<Selo situacao="PENDENTE_ENVIO" atrasado />);
    expect(screen.getByText('Atrasado')).toBeInTheDocument();
    expect(screen.queryByText('Pendente de envio')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('rejeitado e atrasado mostra os dois selos', () => {
    render(<Selo situacao="REJEITADO" atrasado />);
    expect(screen.getByText('Rejeitado')).toBeInTheDocument();
    expect(screen.getByText('Atrasado')).toBeInTheDocument();
  });
});
