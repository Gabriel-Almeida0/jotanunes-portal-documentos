import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { CHAVE_TOKEN } from '../auth/armazenamento';
import { banco, CNPJ_EXEMPLO, SENHA_NOVA_EXEMPLO, SENHA_TEMPORARIA_EXEMPLO } from '../mocks/dados';
import { problema } from '../mocks/problema';
import { server } from '../mocks/server';
import { arquivoPdf, conectarComo, renderizarPortal, rotaAtual } from '../test/utils';

async function abrir() {
  const temp = await conectarComo(CNPJ_EXEMPLO, SENHA_TEMPORARIA_EXEMPLO);
  const emp = banco.empresas.find((e) => e.empresa.id === temp.empresa.id)!;
  emp.senha = SENHA_NOVA_EXEMPLO;
  emp.empresa.trocaSenhaObrigatoria = false;
  await conectarComo(CNPJ_EXEMPLO, SENHA_NOVA_EXEMPLO);
  const r = renderizarPortal('/documentos');
  await screen.findAllByText('Pendente de envio');
  return r;
}

const cartao = () => within(screen.getByRole('article', { name: 'Cartão CNPJ' }));
const input = () => screen.getByLabelText('Arquivo para Cartão CNPJ');

function contarEnvios() {
  return banco.envios.length;
}

describe('EnvioArquivo', () => {
  it('o botão explica os formatos aceitos', async () => {
    await abrir();
    expect(cartao().getByRole('button', { name: 'Enviar documento' })).toHaveAccessibleDescription(
      'PDF, JPG ou PNG, até 10 MB.',
    );
    expect(input()).toHaveAttribute('accept', expect.stringContaining('application/pdf'));
  });

  it('recusa arquivo .exe no cliente com a mensagem do contrato', async () => {
    const { user } = await abrir();
    const antes = contarEnvios();
    const exe = new File(['MZ\x90\x00'], 'programa.exe', { type: 'application/x-msdownload' });
    await user.upload(input(), exe);
    expect(await cartao().findByRole('alert')).toHaveTextContent(
      'Envie um arquivo PDF, JPG ou PNG.',
    );
    expect(cartao().queryByRole('button', { name: 'Enviar arquivo' })).not.toBeInTheDocument();
    expect(contarEnvios()).toBe(antes);
  });

  it('recusa .exe renomeado para .pdf (confere a assinatura dos bytes)', async () => {
    const { user } = await abrir();
    const disfarcado = new File(['MZ\x90\x00programa'], 'documento.pdf', {
      type: 'application/pdf',
    });
    await user.upload(input(), disfarcado);
    expect(await cartao().findByRole('alert')).toHaveTextContent(
      'Envie um arquivo PDF, JPG ou PNG.',
    );
  });

  it('recusa arquivo acima de 10 MB no cliente', async () => {
    const { user } = await abrir();
    await user.upload(input(), arquivoPdf('grande.pdf', 10 * 1024 * 1024 + 1));
    expect(await cartao().findByRole('alert')).toHaveTextContent('O arquivo passa de 10 MB.');
  });

  it('recusa arquivo vazio no cliente', async () => {
    const { user } = await abrir();
    await user.upload(input(), new File([], 'vazio.pdf', { type: 'application/pdf' }));
    expect(await cartao().findByRole('alert')).toHaveTextContent(
      'Não conseguimos ler este arquivo.',
    );
  });

  it('aceita PNG e JPEG pela assinatura', async () => {
    const { user } = await abrir();
    const png = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])],
      'foto.png',
      {
        type: 'image/png',
      },
    );
    await user.upload(input(), png);
    expect(cartao().getByRole('button', { name: 'Enviar arquivo' })).toBeInTheDocument();
    await user.click(cartao().getByRole('button', { name: 'Cancelar' }));

    const jpg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1])], 'foto.jpg', {
      type: 'image/jpeg',
    });
    await user.upload(input(), jpg);
    expect(cartao().getByText('foto.jpg')).toBeInTheDocument();
  });

  it('mostra "Enviando…" durante o envio', async () => {
    let liberar: () => void = () => {};
    server.use(
      http.post('*/api/portal/documentos/:id/envios', async () => {
        await new Promise<void>((r) => (liberar = r));
        return problema(500, 'ERRO_INTERNO');
      }),
    );
    const { user } = await abrir();
    await user.upload(input(), arquivoPdf());
    await user.click(cartao().getByRole('button', { name: 'Enviar arquivo' }));
    const botao = await cartao().findByRole('button', { name: 'Enviando…' });
    expect(botao).toBeDisabled();
    liberar();
    expect(await cartao().findByRole('alert')).toHaveTextContent(
      'Algo deu errado do nosso lado. Tente de novo.',
    );
  });

  it('mostra erros do servidor pelo code (413 e 415)', async () => {
    server.use(
      http.post(
        '*/api/portal/documentos/:id/envios',
        () => problema(415, 'ARQUIVO_TIPO_NAO_SUPORTADO'),
        {
          once: true,
        },
      ),
    );
    const { user } = await abrir();
    await user.upload(input(), arquivoPdf());
    await user.click(cartao().getByRole('button', { name: 'Enviar arquivo' }));
    expect(await cartao().findByRole('alert')).toHaveTextContent(
      'Envie um arquivo PDF, JPG ou PNG.',
    );
  });

  it('sessão expirada durante o envio volta ao login com o aviso para enviar de novo', async () => {
    const { user } = await abrir();
    await user.upload(input(), arquivoPdf());
    banco.empresas[0].versao += 1; // token deixa de valer enquanto a pessoa confere o arquivo
    await user.click(cartao().getByRole('button', { name: 'Enviar arquivo' }));

    expect(
      await screen.findByText('Sua sessão expirou. Entre de novo e envie o arquivo outra vez.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(rotaAtual()).toBe('/acesso'));
    expect(sessionStorage.getItem(CHAVE_TOKEN)).toBeNull();
  });
});
