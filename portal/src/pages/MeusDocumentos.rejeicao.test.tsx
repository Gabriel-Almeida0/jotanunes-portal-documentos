import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { arquivoPdf, conectarComo, EMPRESA_ALFA, renderizarPortal, rotaAtual } from '../test/utils';

describe('MeusDocumentos — rejeição e reenvio', () => {
  it('documento rejeitado aparece primeiro, com o motivo e "Enviar novo arquivo"', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    renderizarPortal('/documentos');

    const cartoes = await screen.findAllByRole('article');
    expect(within(cartoes[0]).getByRole('heading')).toHaveTextContent('Cartão CNPJ');
    const rejeitado = within(cartoes[0]);
    expect(rejeitado.getByText('Rejeitado')).toBeInTheDocument();
    expect(rejeitado.getByText('Motivo:').parentElement).toHaveTextContent(
      'Motivo: Documento ilegível, envie de novo.',
    );
    expect(rejeitado.getByRole('button', { name: 'Enviar novo arquivo' })).toBeInTheDocument();

    // Em análise e aprovado não oferecem envio.
    const emAnalise = within(
      screen.getByRole('article', { name: 'Certidão Negativa de Débitos Federais' }),
    );
    expect(emAnalise.getByText('Em análise')).toBeInTheDocument();
    expect(emAnalise.queryByRole('button', { name: /Enviar/ })).not.toBeInTheDocument();
    const aprovado = within(screen.getByRole('article', { name: 'PCMSO' }));
    expect(aprovado.getByText('Aprovado')).toBeInTheDocument();
    expect(aprovado.queryByRole('button', { name: /Enviar/ })).not.toBeInTheDocument();
  });

  it('reenvio do rejeitado muda para "Em análise"', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    const { user } = renderizarPortal('/documentos');
    const doc = within(await screen.findByRole('article', { name: 'Cartão CNPJ' }));

    await user.upload(
      screen.getByLabelText('Arquivo para Cartão CNPJ'),
      arquivoPdf('cartao-legivel.pdf'),
    );
    await user.click(doc.getByRole('button', { name: 'Enviar arquivo' }));

    await waitFor(() => expect(doc.getByText('Em análise')).toBeInTheDocument());
    expect(doc.queryByText('Rejeitado')).not.toBeInTheDocument();
    expect(doc.queryByText(/Motivo:/)).not.toBeInTheDocument();
    expect(doc.queryByRole('button', { name: 'Enviar novo arquivo' })).not.toBeInTheDocument();
  });

  it('histórico mostra o envio rejeitado com motivo e sem nome de analista', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    const { user } = renderizarPortal('/documentos');
    const pcmso = within(await screen.findByRole('article', { name: 'PCMSO' }));
    await user.click(pcmso.getByRole('link', { name: /Ver histórico de envios/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'PCMSO' })).toBeInTheDocument();
    expect(rotaAtual()).toMatch(/^\/documentos\/.+/);

    const secao = screen.getByRole('region', { name: 'Envios (2)' });
    const envios = within(secao).getAllByRole('listitem');
    expect(envios).toHaveLength(2);
    // Mais recente primeiro: aprovado, depois o rejeitado com motivo.
    expect(within(envios[0]).getByText('Aprovado')).toBeInTheDocument();
    expect(within(envios[1]).getByText('Rejeitado')).toBeInTheDocument();
    expect(envios[1]).toHaveTextContent('Motivo: Falta a assinatura do médico responsável.');
    expect(envios[1]).toHaveTextContent(/Analisado em\s*\d{2}\/\d{2}\/\d{4}/);
    // A empresa nunca vê quem analisou.
    expect(document.body).not.toHaveTextContent(/analista|analisado por/i);
  });

  it('histórico de tipo inexistente mostra "Não encontramos o que você procurou."', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    renderizarPortal('/documentos/00000000-0000-4000-8000-00000000ffff');
    expect(await screen.findByText('Não encontramos o que você procurou.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voltar para meus documentos/ })).toBeInTheDocument();
  });
});
