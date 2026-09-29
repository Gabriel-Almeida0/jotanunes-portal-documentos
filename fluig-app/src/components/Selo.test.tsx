import { render, screen } from '@testing-library/react';
import { SeloSituacao, type Situacao } from './Selo';

describe('SeloSituacao', () => {
  it.each<[Situacao, string]>([
    ['PENDENTE_ENVIO', 'Pendente de envio'],
    ['EM_ANALISE', 'Em análise'],
    ['APROVADO', 'Aprovado'],
    ['REJEITADO', 'Rejeitado'],
    ['NAO_CONVIDADA', 'Não convidada'],
    ['CONVIDADA', 'Convidada'],
    ['CONVITE_EXPIRADO', 'Convite expirado'],
    ['ATIVA', 'Acesso ativo'],
    ['DESATIVADA', 'Desativada'],
    ['VALIDO', 'Válido'],
    ['USADO', 'Usado'],
    ['EXPIRADO', 'Expirado'],
    ['SUBSTITUIDO', 'Substituído'],
  ])('%s é exibido com o texto "%s" (nunca só cor)', (situacao, texto) => {
    render(<SeloSituacao situacao={situacao} />);
    const selo = screen.getByText(texto);
    expect(selo).toBeVisible();
    expect(selo.closest('.jn-selo')).toHaveAttribute('data-tom');
  });

  it('usa tons diferentes para aprovado e rejeitado', () => {
    render(
      <>
        <SeloSituacao situacao="APROVADO" />
        <SeloSituacao situacao="REJEITADO" />
      </>,
    );
    expect(screen.getByText('Aprovado').closest('.jn-selo')).toHaveAttribute('data-tom', 'sucesso');
    expect(screen.getByText('Rejeitado').closest('.jn-selo')).toHaveAttribute('data-tom', 'perigo');
  });
});
