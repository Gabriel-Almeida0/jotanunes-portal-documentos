import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import type { ObraPortal } from '../api/tipos';
import { banco, CNPJ_EXEMPLO, SENHA_NOVA_EXEMPLO, SENHA_TEMPORARIA_EXEMPLO } from '../mocks/dados';
import { server } from '../mocks/server';
import {
  conectarComo,
  EMPRESA_ALFA,
  EMPRESA_DELTA,
  renderizarPortal,
  rotaAtual,
} from '../test/utils';

const idObra = (nome: string) => banco.obras.find((o) => o.nome === nome)!.id;

function cartoesObra(): HTMLElement[] {
  return within(screen.getByRole('list', { name: 'Obras' })).getAllByRole('article');
}

describe('Resumo (/documentos) — documentos gerais e obras', () => {
  it('mostra os documentos gerais e um cartão por obra ativa vinculada, com cidade/UF e progresso', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    renderizarPortal('/documentos');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Documentos gerais da empresa' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Suas obras' })).toBeInTheDocument();

    // Os gerais continuam no resumo (só tipos GERAL).
    const gerais = within(screen.getByRole('list', { name: 'Documentos gerais exigidos' }));
    expect(gerais.getAllByRole('article')).toHaveLength(4);
    expect(gerais.queryByRole('article', { name: 'ART da obra' })).not.toBeInTheDocument();

    // Vínculo encerrado (Mar Azul) e obra inativa (Torre) não aparecem.
    const obras = cartoesObra();
    expect(obras).toHaveLength(2);
    expect(screen.queryByText('Condomínio Mar Azul')).not.toBeInTheDocument();
    expect(screen.queryByText('Torre Empresarial Centro')).not.toBeInTheDocument();

    const atlantico = within(screen.getByRole('article', { name: 'Edifício Atlântico' }));
    expect(atlantico.getByText('Maceió/AL')).toBeInTheDocument();
    expect(atlantico.getByText('1 de 3 aprovados')).toBeInTheDocument();
    expect(atlantico.getByText('1 pendente de envio')).toBeInTheDocument();
    // Relatório trimestral: o trimestre rejeitado com prazo vencido conta como período atrasado.
    expect(atlantico.getByText('1 rejeitado')).toBeInTheDocument();
    expect(atlantico.getByText('1 período atrasado')).toBeInTheDocument();

    const parque = within(screen.getByRole('article', { name: 'Residencial Parque das Flores' }));
    expect(parque.getByText('Aracaju/SE')).toBeInTheDocument();
    expect(parque.getByText('0 de 2 aprovados')).toBeInTheDocument();
    expect(parque.getByText('1 rejeitado')).toBeInTheDocument();
    expect(parque.getByText('1 em análise')).toBeInTheDocument();
  });

  it('ordena as obras com pendência primeiro, depois pelo nome', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    const contagem = (pendentes: number) => ({
      total: 2,
      pendentes,
      emAnalise: 0,
      aprovados: 2 - pendentes,
      rejeitados: 0,
      periodosAtrasados: 0,
    });
    server.use(
      http.get('*/api/portal/obras', () =>
        HttpResponse.json<ObraPortal[]>([
          {
            id: idObra('Condomínio Vila Real'),
            nome: 'Alfa Obra',
            cidade: 'Aracaju',
            uf: 'SE',
            documentos: contagem(0),
          },
          {
            id: idObra('Galpão Logístico Norte'),
            nome: 'Zeta Obra',
            cidade: 'Aracaju',
            uf: 'SE',
            documentos: contagem(1),
          },
          {
            id: idObra('Edifício Atlântico'),
            nome: 'Beta Obra',
            cidade: 'Aracaju',
            uf: 'SE',
            documentos: contagem(0),
          },
        ]),
      ),
    );
    renderizarPortal('/documentos');
    await screen.findByRole('heading', { name: 'Suas obras' });
    const nomes = (await screen.findAllByTestId('cartao-obra')).map(
      (c) => within(c).getByRole('heading').textContent,
    );
    expect(nomes).toEqual(['Zeta Obra', 'Alfa Obra', 'Beta Obra']);
  });

  it('obra toda aprovada mostra "Tudo certo" e obra sem tipos mostra "Nenhum documento exigido"', async () => {
    await conectarComo(EMPRESA_DELTA.cnpj, EMPRESA_DELTA.senha);
    renderizarPortal('/documentos');

    const vilaReal = within(await screen.findByRole('article', { name: 'Condomínio Vila Real' }));
    expect(vilaReal.getByText('1 de 1 aprovado')).toBeInTheDocument();
    expect(vilaReal.getByText('Tudo certo')).toBeInTheDocument();
    const galpao = within(screen.getByRole('article', { name: 'Galpão Logístico Norte' }));
    expect(galpao.getByText('Nenhum documento exigido')).toBeInTheDocument();
    expect(galpao.queryByText(/aprovad/)).not.toBeInTheDocument();
  });

  it('empresa sem obra mostra os gerais e a mensagem de que ainda não está em nenhuma obra', async () => {
    const temp = await conectarComo(CNPJ_EXEMPLO, SENHA_TEMPORARIA_EXEMPLO);
    const emp = banco.empresas.find((e) => e.empresa.id === temp.empresa.id)!;
    emp.senha = SENHA_NOVA_EXEMPLO;
    emp.empresa.trocaSenhaObrigatoria = false;
    await conectarComo(CNPJ_EXEMPLO, SENHA_NOVA_EXEMPLO);
    renderizarPortal('/documentos');

    expect(
      await screen.findByText(
        'Você ainda não está em nenhuma obra. Quando a Jotanunes vincular sua empresa a uma obra, os documentos dela aparecem aqui.',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Pendente de envio')).toHaveLength(4);
    expect(screen.queryByTestId('cartao-obra')).not.toBeInTheDocument();
  });

  it('clicar na obra abre a página da obra', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    const { user } = renderizarPortal('/documentos');
    await user.click(await screen.findByRole('link', { name: 'Edifício Atlântico' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Edifício Atlântico' }),
    ).toBeInTheDocument();
    expect(rotaAtual()).toBe(`/obras/${idObra('Edifício Atlântico')}`);
  });
});
