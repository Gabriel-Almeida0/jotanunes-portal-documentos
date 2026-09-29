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
          empresasConvidadasSemAcesso: 3,
          empresasAtivas: 41,
          obrasAtivas: 5,
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
});
