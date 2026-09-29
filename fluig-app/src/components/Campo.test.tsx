import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Campo, CampoArea, CampoSelecao } from './Campo';

describe('Campo', () => {
  it('associa o rótulo ao input', async () => {
    render(<Campo rotulo="Razão social" defaultValue="" />);
    const input = screen.getByLabelText('Razão social');
    expect(input.tagName).toBe('INPUT');
    await userEvent.type(input, 'Alfa');
    expect(input).toHaveValue('Alfa');
  });

  it('mostra o erro ligado ao campo por aria-describedby e marca aria-invalid', () => {
    render(<Campo rotulo="CNPJ" erro="CNPJ inválido." />);
    const input = screen.getByLabelText('CNPJ');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(/CNPJ inválido\./);
    expect(screen.getByText('CNPJ inválido.')).toBeInTheDocument();
  });

  it('inclui a ajuda na descrição acessível e indica campo obrigatório', () => {
    render(<Campo rotulo="E-mail" ajuda="Para onde vai o convite." obrigatorio />);
    const input = screen.getByRole('textbox', { name: /E-mail/ });
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription('Para onde vai o convite.');
  });

  it('funciona com select e textarea', () => {
    render(
      <>
        <CampoSelecao rotulo="UF" erro="Escolha uma UF válida.">
          <option value="">Selecionar</option>
          <option value="SE">SE</option>
        </CampoSelecao>
        <CampoArea rotulo="Instruções" />
      </>,
    );
    expect(screen.getByLabelText('UF').tagName).toBe('SELECT');
    expect(screen.getByLabelText('UF')).toHaveAccessibleDescription('Escolha uma UF válida.');
    expect(screen.getByLabelText('Instruções').tagName).toBe('TEXTAREA');
  });
});
