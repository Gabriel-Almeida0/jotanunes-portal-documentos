import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Abas } from './Abas';

function Exemplo() {
  const [ativa, setAtiva] = useState('a');
  return (
    <div className="jn-app">
      <Abas
        rotulo="Seções"
        ativa={ativa}
        onTrocar={setAtiva}
        abas={[
          { id: 'a', rotulo: 'Primeira', conteudo: <p>Conteúdo A</p> },
          { id: 'b', rotulo: 'Segunda', conteudo: <p>Conteúdo B</p> },
          { id: 'c', rotulo: 'Terceira', conteudo: <p>Conteúdo C</p> },
        ]}
      />
    </div>
  );
}

describe('Abas', () => {
  it('segue o padrão WAI-ARIA e troca com clique e setas', async () => {
    const usuario = userEvent.setup();
    render(<Exemplo />);
    const lista = screen.getByRole('tablist', { name: 'Seções' });
    expect(lista).toBeInTheDocument();
    const primeira = screen.getByRole('tab', { name: 'Primeira' });
    expect(primeira).toHaveAttribute('aria-selected', 'true');
    expect(primeira).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Segunda' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tabpanel', { name: 'Primeira' })).toHaveTextContent('Conteúdo A');

    await usuario.click(screen.getByRole('tab', { name: 'Terceira' }));
    expect(screen.getByRole('tabpanel', { name: 'Terceira' })).toHaveTextContent('Conteúdo C');
    expect(screen.queryByText('Conteúdo A')).not.toBeInTheDocument();

    await usuario.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Primeira' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Primeira' })).toHaveAttribute('aria-selected', 'true');
    await usuario.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Terceira' })).toHaveFocus();
    await usuario.keyboard('{Home}');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Conteúdo A');
  });
});
