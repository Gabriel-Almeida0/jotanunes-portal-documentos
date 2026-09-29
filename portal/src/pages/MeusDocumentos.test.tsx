import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CNPJ_EXEMPLO, SENHA_NOVA_EXEMPLO, SENHA_TEMPORARIA_EXEMPLO, banco } from '../mocks/dados';
import { problema } from '../mocks/problema';
import { server } from '../mocks/server';
import {
  arquivoPdf,
  conectarComo,
  EMPRESA_ALFA,
  EMPRESA_DELTA,
  renderizarPortal,
} from '../test/utils';
import { api } from '../api/client';

/** Empresa de exemplo já com a senha trocada (3 documentos pendentes). */
async function conectarEmpresaNova() {
  const temp = await conectarComo(CNPJ_EXEMPLO, SENHA_TEMPORARIA_EXEMPLO);
  const emp = banco.empresas.find((e) => e.empresa.id === temp.empresa.id)!;
  emp.senha = SENHA_NOVA_EXEMPLO;
  emp.empresa.trocaSenhaObrigatoria = false;
  return conectarComo(CNPJ_EXEMPLO, SENHA_NOVA_EXEMPLO);
}

function cartao(nome: string): HTMLElement {
  return screen.getByRole('article', { name: nome });
}

afterEach(() => vi.restoreAllMocks());

describe('MeusDocumentos', () => {
  it('mostra os 3 documentos exigidos como "Pendente de envio", com nome e instruções', async () => {
    await conectarEmpresaNova();
    renderizarPortal('/documentos');

    expect(await screen.findAllByText('Pendente de envio')).toHaveLength(3);
    for (const nome of ['Cartão CNPJ', 'Certidão Negativa de Débitos Federais', 'PCMSO']) {
      expect(
        within(cartao(nome)).getByRole('button', { name: 'Enviar documento' }),
      ).toBeInTheDocument();
    }
    expect(within(cartao('Cartão CNPJ')).getByText(/Receita Federal/)).toBeInTheDocument();
    expect(screen.getByText(/Faltam 3 documentos/)).toBeInTheDocument();
  });

  it('enviar um PDF muda a situação para "Em análise" e some o botão de envio', async () => {
    await conectarEmpresaNova();
    const { user } = renderizarPortal('/documentos');
    await screen.findAllByText('Pendente de envio');

    await user.upload(screen.getByLabelText('Arquivo para Cartão CNPJ'), arquivoPdf('cartao.pdf'));
    const doCartao = within(cartao('Cartão CNPJ'));
    expect(doCartao.getByText('cartao.pdf')).toBeInTheDocument();
    await user.click(doCartao.getByRole('button', { name: 'Enviar arquivo' }));

    await waitFor(() => expect(doCartao.getByText('Em análise')).toBeInTheDocument());
    expect(doCartao.queryByRole('button', { name: /Enviar/ })).not.toBeInTheDocument();
    expect(doCartao.getByRole('button', { name: 'Baixar cartao.pdf' })).toBeInTheDocument();
    expect(doCartao.getByText(/enviado em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/)).toBeInTheDocument();
    expect(screen.getByText(/Recebemos o arquivo de Cartão CNPJ/)).toBeInTheDocument();
    expect(screen.getByText(/Faltam 2 documentos/)).toBeInTheDocument();
  });

  it('exibe ENVIO_NAO_PERMITIDO vindo do servidor', async () => {
    await conectarEmpresaNova();
    server.use(
      http.post('*/api/portal/documentos/:id/envios', () => problema(409, 'ENVIO_NAO_PERMITIDO')),
    );
    const { user } = renderizarPortal('/documentos');
    await screen.findAllByText('Pendente de envio');

    await user.upload(screen.getByLabelText('Arquivo para PCMSO'), arquivoPdf());
    await user.click(within(cartao('PCMSO')).getByRole('button', { name: 'Enviar arquivo' }));

    expect(
      await screen.findByText('Este documento já está em análise ou aprovado.'),
    ).toBeInTheDocument();
  });

  it('mostra o estado vazio quando não há documento pendente nem rejeitado', async () => {
    await conectarComo(EMPRESA_DELTA.cnpj, EMPRESA_DELTA.senha);
    renderizarPortal('/documentos');
    expect(
      await screen.findByText('Nenhum documento pendente. Tudo certo por aqui.'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Aprovado')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Enviar/ })).not.toBeInTheDocument();
  });

  it('mostra o estado vazio quando não há nenhum tipo de documento', async () => {
    await conectarEmpresaNova();
    server.use(http.get('*/api/portal/documentos', () => HttpResponse.json([])));
    renderizarPortal('/documentos');
    expect(
      await screen.findByText('Nenhum documento pendente. Tudo certo por aqui.'),
    ).toBeInTheDocument();
  });

  it('erro ao carregar mostra o title do servidor e permite tentar de novo', async () => {
    await conectarEmpresaNova();
    server.use(
      http.get('*/api/portal/documentos', () => problema(500, 'ERRO_INTERNO'), { once: true }),
    );
    const { user } = renderizarPortal('/documentos');
    expect(
      await screen.findByText('Algo deu errado do nosso lado. Tente de novo.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findAllByText('Pendente de envio')).toHaveLength(3);
  });

  it('download chama a URL do envio com o Bearer da sessão', async () => {
    const sessao = await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    let pedido: { url: string; authorization: string | null } | null = null;
    server.use(
      http.get('*/api/portal/envios/:envioId/arquivo', ({ request }) => {
        pedido = { url: request.url, authorization: request.headers.get('Authorization') };
        return new HttpResponse(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': "attachment; filename*=UTF-8''cnd-federal-alfa.pdf",
          },
        });
      }),
    );
    const criarUrl = vi.fn(() => 'blob:mock');
    Object.assign(URL, { createObjectURL: criarUrl, revokeObjectURL: vi.fn() });
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { user } = renderizarPortal('/documentos');
    await user.click(await screen.findByRole('button', { name: 'Baixar cnd-federal-alfa.pdf' }));

    await waitFor(() => expect(clique).toHaveBeenCalled());
    const envioId = banco.envios.find((e) => e.nomeArquivo === 'cnd-federal-alfa.pdf')!.id;
    expect(pedido).toEqual({
      url: `http://localhost:5080/api/portal/envios/${envioId}/arquivo`,
      authorization: `Bearer ${sessao.accessToken}`,
    });
    expect(criarUrl).toHaveBeenCalled();
  });

  it('sessão revogada ao carregar volta para o acesso com o aviso', async () => {
    await conectarEmpresaNova();
    banco.empresas[0].versao += 1; // ex.: a Jotanunes reenviou o convite
    renderizarPortal('/documentos');
    expect(await screen.findByText('Sua sessão expirou. Entre de novo.')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Acesse o portal de documentos' }),
    ).toBeInTheDocument();
    // Garante que o cliente continua funcionando depois (sem token).
    await expect(api.listarDocumentos()).rejects.toMatchObject({ code: 'NAO_AUTENTICADO' });
  });
});
