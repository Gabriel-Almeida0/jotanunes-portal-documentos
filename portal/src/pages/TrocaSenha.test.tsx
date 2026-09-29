import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { CNPJ_EXEMPLO, SENHA_NOVA_EXEMPLO, SENHA_TEMPORARIA_EXEMPLO } from '../mocks/dados';
import { server } from '../mocks/server';
import { conectarComo, renderizarPortal, rotaAtual } from '../test/utils';

async function abrirTroca() {
  await conectarComo(CNPJ_EXEMPLO, SENHA_TEMPORARIA_EXEMPLO);
  return renderizarPortal('/trocar-senha');
}

describe('TrocaSenha', () => {
  it('com a troca pendente, /documentos volta para a troca de senha', async () => {
    await conectarComo(CNPJ_EXEMPLO, SENHA_TEMPORARIA_EXEMPLO);
    renderizarPortal('/documentos');
    expect(rotaAtual()).toBe('/trocar-senha');
    expect(
      screen.getByRole('heading', { name: 'Crie uma nova senha para continuar.' }),
    ).toBeInTheDocument();
  });

  it('senha fraca é recusada no cliente, sem chamar a API', async () => {
    let chamou = false;
    server.use(
      http.post('*/api/portal/auth/trocar-senha', () => {
        chamou = true;
      }),
    );
    const { user } = await abrirTroca();

    await user.type(screen.getByLabelText('Senha atual'), SENHA_TEMPORARIA_EXEMPLO);
    await user.type(screen.getByLabelText('Nova senha'), 'abc');
    await user.type(screen.getByLabelText('Confirme a nova senha'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Salvar e continuar' }));

    expect(
      await screen.findByText('A senha precisa ter pelo menos 8 caracteres, com letras e números.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nova senha')).toHaveAttribute('aria-invalid', 'true');
    expect(chamou).toBe(false);
  });

  it('mostra as regras da senha sendo cumpridas enquanto digita', async () => {
    const { user } = await abrirTroca();
    const regras = screen.getByRole('list', { name: 'A nova senha precisa ter' });
    expect(regras).toHaveTextContent('Pelo menos 8 caracteres (falta)');
    await user.type(screen.getByLabelText('Nova senha'), 'Abcdefg1');
    expect(regras).toHaveTextContent('Pelo menos 8 caracteres (ok)');
    expect(regras).toHaveTextContent('Pelo menos um número (ok)');
  });

  it('confirmação diferente é recusada', async () => {
    const { user } = await abrirTroca();
    await user.type(screen.getByLabelText('Senha atual'), SENHA_TEMPORARIA_EXEMPLO);
    await user.type(screen.getByLabelText('Nova senha'), SENHA_NOVA_EXEMPLO);
    await user.type(screen.getByLabelText('Confirme a nova senha'), 'Outra1234');
    await user.click(screen.getByRole('button', { name: 'Salvar e continuar' }));
    expect(await screen.findByText('As senhas não são iguais.')).toBeInTheDocument();
  });

  it('senha atual incorreta vem do servidor e aparece no campo', async () => {
    const { user } = await abrirTroca();
    await user.type(screen.getByLabelText('Senha atual'), 'Errada123');
    await user.type(screen.getByLabelText('Nova senha'), SENHA_NOVA_EXEMPLO);
    await user.type(screen.getByLabelText('Confirme a nova senha'), SENHA_NOVA_EXEMPLO);
    await user.click(screen.getByRole('button', { name: 'Salvar e continuar' }));
    expect(await screen.findByText('A senha atual não confere.')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha atual')).toHaveFocus();
  });

  it('troca bem-sucedida leva a "Meus documentos" com os 3 pendentes', async () => {
    const { user } = await abrirTroca();
    await user.type(screen.getByLabelText('Senha atual'), SENHA_TEMPORARIA_EXEMPLO);
    await user.type(screen.getByLabelText('Nova senha'), SENHA_NOVA_EXEMPLO);
    await user.type(screen.getByLabelText('Confirme a nova senha'), SENHA_NOVA_EXEMPLO);
    await user.click(screen.getByRole('button', { name: 'Salvar e continuar' }));

    expect(await screen.findByRole('heading', { name: 'Meus documentos' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Pendente de envio')).toHaveLength(3));
    expect(screen.getByText('Senha criada. Agora é só enviar os documentos.')).toBeInTheDocument();
    expect(rotaAtual()).toBe('/documentos');
  });

  it('depois da troca, a senha do convite deixa de funcionar e a nova funciona', async () => {
    const { user } = await abrirTroca();
    await user.type(screen.getByLabelText('Senha atual'), SENHA_TEMPORARIA_EXEMPLO);
    await user.type(screen.getByLabelText('Nova senha'), SENHA_NOVA_EXEMPLO);
    await user.type(screen.getByLabelText('Confirme a nova senha'), SENHA_NOVA_EXEMPLO);
    await user.click(screen.getByRole('button', { name: 'Salvar e continuar' }));
    await screen.findByRole('heading', { name: 'Meus documentos' });

    await user.click(screen.getByRole('button', { name: 'Sair' }));
    await user.type(await screen.findByLabelText('CNPJ'), CNPJ_EXEMPLO);
    await user.type(screen.getByLabelText('Senha'), SENHA_TEMPORARIA_EXEMPLO);
    await user.click(screen.getByRole('button', { name: 'Acessar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('CNPJ ou senha incorretos.');

    await user.type(screen.getByLabelText('Senha'), SENHA_NOVA_EXEMPLO);
    await user.click(screen.getByRole('button', { name: 'Acessar' }));
    expect(await screen.findByRole('heading', { name: 'Meus documentos' })).toBeInTheDocument();
  });
});
