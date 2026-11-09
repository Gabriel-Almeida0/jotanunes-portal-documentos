import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { renderizarRota } from '../test/renderizar';

describe('Painel', () => {
  beforeEach(() => {
    server.use(
      http.get('*/api/fluig/painel', () =>
        HttpResponse.json({
          enviosEmAnalise: 7,
          empresasComPendencia: 12,
          obrasComPendencia: 2,
          empresasConvidadasSemAcesso: 3,
          empresasAtivas: 41,
          obrasAtivas: 5,
          empresasComAtraso: 4,
        }),
      ),
    );
  });

  it('mostra o nome do usuário e os indicadores com os números da API', async () => {
    renderizarRota('/');
    expect(await screen.findByText(/Olá, Analista!/)).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('documentos aguardando análise')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('41')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('obras com pendência (documento da obra pendente ou rejeitado)')).toBeInTheDocument();
    expect(screen.getByText('empresas com pendência (documento geral ou da obra pendente ou rejeitado)')).toBeInTheDocument();
  });

  it('clicar em "obras com pendência" abre a lista de obras filtrada', async () => {
    const { usuario, local } = renderizarRota('/');
    await usuario.click(await screen.findByRole('link', { name: /Ver obras com pendência/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Obras' })).toBeInTheDocument();
    expect(local()).toBe('/obras?comPendencia=true');
    expect(screen.getByRole('checkbox', { name: 'Com pendência' })).toBeChecked();
    // Vista do Rio e Flor de Sal têm documento da obra pendente; Palmeiras está inativa.
    expect(await screen.findByText('Residencial Vista do Rio')).toBeInTheDocument();
    expect(screen.getByText('Condomínio Flor de Sal')).toBeInTheDocument();
    expect(screen.queryByText('Parque das Palmeiras')).not.toBeInTheDocument();
  });

  it('clicar em "empresas com pendência" abre a lista filtrada', async () => {
    const { usuario, local } = renderizarRota('/');
    await usuario.click(await screen.findByRole('link', { name: /Ver empresas com pendência/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Empresas' })).toBeInTheDocument();
    expect(local()).toBe('/empresas?comPendencia=true');
    expect(screen.getByRole('checkbox', { name: 'Com pendência' })).toBeChecked();
    // Só aparecem empresas ativas com pendente ou rejeitado.
    expect(await screen.findByText('Alfa Engenharia Ltda')).toBeInTheDocument();
    expect(screen.queryByText('Épsilon Terraplenagem Ltda')).not.toBeInTheDocument();
  });

  it('o card de convidadas leva à lista filtrada por situação de acesso', async () => {
    const { usuario, local } = renderizarRota('/');
    await usuario.click(await screen.findByRole('link', { name: /Convidadas/ }));
    expect(local()).toBe('/empresas?situacaoAcesso=CONVIDADA');
    expect(await screen.findByText('Beta Serviços de Montagem S.A.')).toBeInTheDocument();
    expect(screen.queryByText('Alfa Engenharia Ltda')).not.toBeInTheDocument();
  });

  it('mostra "empresas com período atrasado" e leva à lista filtrada (003)', async () => {
    const { usuario, local } = renderizarRota('/');
    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(
      screen.getByText('empresas com período atrasado (documento periódico com prazo vencido)'),
    ).toBeInTheDocument();
    await usuario.click(screen.getByRole('link', { name: /Ver empresas com atraso/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Empresas' })).toBeInTheDocument();
    expect(local()).toBe('/empresas?comAtraso=true');
    expect(screen.getByRole('checkbox', { name: 'Com atraso' })).toBeChecked();
  });
});
