import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { api } from '../api/client';
import { banco } from '../mocks/dados';
import {
  arquivoPdf,
  conectarComo,
  EMPRESA_ALFA,
  EMPRESA_DELTA,
  renderizarPortal,
  rotaAtual,
} from '../test/utils';

const idObra = (nome: string) => banco.obras.find((o) => o.nome === nome)!.id;
const idTipo = (nome: string) => banco.tipos.find((t) => t.nome === nome)!.id;

function cartao(nome: string): HTMLElement {
  return screen.getByRole('article', { name: nome });
}

describe('DocumentosObra (/obras/:obraId)', () => {
  it('mostra só os documentos da obra, com o nome da obra sempre visível e o link de volta', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    renderizarPortal(`/obras/${idObra('Residencial Parque das Flores')}`);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Residencial Parque das Flores' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('contexto-obra')).toHaveTextContent(
      'Obra: Residencial Parque das Flores · Aracaju/SE',
    );
    expect(screen.getByRole('link', { name: /Voltar para o resumo/ })).toHaveAttribute(
      'href',
      '/documentos',
    );

    const cartoes = screen.getAllByRole('article');
    expect(cartoes.map((c) => within(c).getByRole('heading').textContent)).toEqual([
      'ART da obra',
      'Ordem de serviço',
    ]);
    expect(screen.queryByRole('article', { name: 'Cartão CNPJ' })).not.toBeInTheDocument();
    expect(screen.getByText(/Falta 1 documento nesta obra/)).toBeInTheDocument();
  });

  it('enviar na obra muda só aquele documento daquela obra', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    const atlantico = idObra('Edifício Atlântico');
    const { user } = renderizarPortal(`/obras/${atlantico}`);
    const art = within(await screen.findByRole('article', { name: 'ART da obra' }));
    expect(art.getByText('Pendente de envio')).toBeInTheDocument();

    await user.upload(screen.getByLabelText('Arquivo para ART da obra'), arquivoPdf('art.pdf'));
    await user.click(art.getByRole('button', { name: 'Enviar arquivo' }));

    await waitFor(() => expect(art.getByText('Em análise')).toBeInTheDocument());
    expect(
      screen.getByText(/Recebemos o arquivo de ART da obra da obra Edifício Atlântico/),
    ).toBeInTheDocument();
    const novo = banco.envios.find((e) => e.nomeArquivo === 'art.pdf')!;
    expect(novo.obraId).toBe(atlantico);

    // Na outra obra, o mesmo tipo continua como estava (rejeitado).
    await user.click(screen.getByRole('link', { name: /Voltar para o resumo/ }));
    await user.click(await screen.findByRole('link', { name: 'Residencial Parque das Flores' }));
    const artParque = within(await screen.findByRole('article', { name: 'ART da obra' }));
    expect(artParque.getByText('Rejeitado')).toBeInTheDocument();
    // E os gerais não mudam: nenhum envio geral novo.
    expect(
      banco.envios.filter((e) => e.obraId === null && e.nomeArquivo === 'art.pdf'),
    ).toHaveLength(0);
  });

  it('documento rejeitado mostra o motivo e "Enviar novo arquivo"; reenviar volta a "Em análise"', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    const { user } = renderizarPortal(`/obras/${idObra('Residencial Parque das Flores')}`);
    const art = within(await screen.findByRole('article', { name: 'ART da obra' }));
    expect(art.getByText('Rejeitado')).toBeInTheDocument();
    expect(art.getByText('Motivo:').parentElement).toHaveTextContent(
      'Motivo: ART sem a assinatura do contratante.',
    );

    await user.upload(screen.getByLabelText('Arquivo para ART da obra'), arquivoPdf('art-ok.pdf'));
    await user.click(art.getByRole('button', { name: 'Enviar arquivo' }));
    await waitFor(() => expect(art.getByText('Em análise')).toBeInTheDocument());
    expect(art.queryByRole('button', { name: 'Enviar novo arquivo' })).not.toBeInTheDocument();
    expect(cartao('Ordem de serviço')).toHaveTextContent('Em análise');
  });

  it('obra com tudo aprovado mostra "Tudo certo nesta obra." e o histórico continua acessível', async () => {
    await conectarComo(EMPRESA_DELTA.cnpj, EMPRESA_DELTA.senha);
    const vilaReal = idObra('Condomínio Vila Real');
    const { user } = renderizarPortal(`/obras/${vilaReal}`);
    expect(await screen.findByText('Tudo certo nesta obra.')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /Ver histórico de envios de ART da obra/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'ART da obra' }),
    ).toBeInTheDocument();
    expect(rotaAtual()).toBe(`/obras/${vilaReal}/documentos/${idTipo('ART da obra')}`);
    expect(screen.getByTestId('contexto-obra')).toHaveTextContent('Condomínio Vila Real');
    const secao = within(screen.getByRole('region', { name: 'Envios (1)' }));
    expect(secao.getByText('Aprovado')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /Voltar para a obra Condomínio Vila Real/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Condomínio Vila Real' }),
    ).toBeInTheDocument();
  });

  it('obra sem tipos exigidos mostra "Nenhum documento exigido nesta obra."', async () => {
    await conectarComo(EMPRESA_DELTA.cnpj, EMPRESA_DELTA.senha);
    renderizarPortal(`/obras/${idObra('Galpão Logístico Norte')}`);
    expect(await screen.findByText('Nenhum documento exigido nesta obra.')).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('histórico da obra envia no contexto da obra e mostra o motivo', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    const parque = idObra('Residencial Parque das Flores');
    const { user } = renderizarPortal(`/obras/${parque}/documentos/${idTipo('ART da obra')}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'ART da obra' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('contexto-obra')).toHaveTextContent('Residencial Parque das Flores');
    expect(screen.getByText('Motivo:').parentElement).toHaveTextContent(
      'Motivo: ART sem a assinatura do contratante.',
    );

    await user.upload(screen.getByLabelText('Arquivo para ART da obra'), arquivoPdf('art-2.pdf'));
    await user.click(screen.getByRole('button', { name: 'Enviar arquivo' }));
    expect(
      await screen.findByText(/Recebemos o arquivo da obra Residencial Parque das Flores/),
    ).toBeInTheDocument();
    expect(banco.envios.find((e) => e.nomeArquivo === 'art-2.pdf')!.obraId).toBe(parque);
  });

  it.each([
    ['vínculo encerrado', 'Condomínio Mar Azul', EMPRESA_ALFA],
    ['obra inativa', 'Torre Empresarial Centro', EMPRESA_ALFA],
    ['obra de outra empresa', 'Condomínio Vila Real', EMPRESA_ALFA],
  ])('%s → "Obra não encontrada" com link para o resumo', async (_caso, nome, empresa) => {
    await conectarComo(empresa.cnpj, empresa.senha);
    renderizarPortal(`/obras/${idObra(nome)}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Obra não encontrada' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(nome)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voltar para o resumo/ })).toBeInTheDocument();
  });

  it('rotas fora do alcance respondem como "não encontrado" (mock segue o contrato)', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    const art = idTipo('ART da obra');
    // Tipo POR_OBRA não existe nas rotas gerais.
    await expect(api.listarHistorico(art)).rejects.toMatchObject({ code: 'NAO_ENCONTRADO' });
    // Envio de obra com vínculo encerrado não pode ser baixado.
    const envioMarAzul = banco.envios.find((e) => e.nomeArquivo === 'art-mar-azul.pdf')!;
    await expect(api.baixarArquivoEnvio(envioMarAzul)).rejects.toMatchObject({
      code: 'NAO_ENCONTRADO',
    });
    // Envio para obra encerrada é recusado.
    await expect(
      api.enviarDocumentoObra(idObra('Condomínio Mar Azul'), art, arquivoPdf()),
    ).rejects.toMatchObject({ code: 'NAO_ENCONTRADO' });
  });
});
