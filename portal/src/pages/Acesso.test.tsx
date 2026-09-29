import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import {
  banco,
  CNPJ_EXEMPLO,
  SENHA_TEMPORARIA_EXEMPLO,
  TOKEN_CONVITE_VALIDO,
} from '../mocks/dados';
import { problema } from '../mocks/problema';
import { server } from '../mocks/server';
import { buscaAtual, EMPRESA_ALFA, renderizarPortal, rotaAtual } from '../test/utils';

async function entrar(
  user: ReturnType<typeof renderizarPortal>['user'],
  cnpj: string,
  senha: string,
) {
  const campoCnpj = screen.getByLabelText('CNPJ');
  await user.clear(campoCnpj);
  await user.type(campoCnpj, cnpj);
  const campoSenha = screen.getByLabelText('Senha');
  await user.clear(campoSenha);
  await user.type(campoSenha, senha);
  await user.click(screen.getByRole('button', { name: 'Acessar' }));
}

describe('Acesso', () => {
  it('mostra a tela de acesso com o texto da marca', () => {
    renderizarPortal('/acesso');
    expect(
      screen.getByRole('heading', { name: 'Acesse o portal de documentos' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('CNPJ')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acessar' })).toBeInTheDocument();
  });

  it('link de convite pré-preenche o CNPJ', async () => {
    renderizarPortal(`/acesso?convite=${TOKEN_CONVITE_VALIDO}`);
    await waitFor(() => expect(screen.getByLabelText('CNPJ')).toHaveValue('12.345.678/0001-95'));
    expect(screen.getByText('Olá, Exemplo Serviços de Engenharia Ltda!')).toBeInTheDocument();
  });

  describe('token do convite fora da URL', () => {
    afterEach(() => {
      window.history.replaceState(null, '', '/');
      vi.restoreAllMocks();
    });

    it('tira o convite da URL antes de validar e envia o token no corpo do POST', async () => {
      const chamadas: { metodo: string; url: string; corpo: unknown }[] = [];
      server.use(
        http.all('*/api/portal/convites/*', async ({ request }) => {
          chamadas.push({
            metodo: request.method,
            url: request.url,
            corpo: await request.json().catch(() => null),
          });
          return HttpResponse.json({
            cnpj: '12345678000195',
            razaoSocial: 'Exemplo Serviços de Engenharia Ltda',
            expiraEm: new Date(Date.now() + 86_400_000).toISOString(),
          });
        }),
      );
      renderizarPortal(`/acesso?convite=${TOKEN_CONVITE_VALIDO}&origem=email`);

      await waitFor(() => expect(screen.getByLabelText('CNPJ')).toHaveValue('12.345.678/0001-95'));
      expect(chamadas).toHaveLength(1);
      expect(chamadas[0].metodo).toBe('POST');
      expect(new URL(chamadas[0].url).pathname).toBe('/api/portal/convites/validar');
      expect(chamadas[0].url).not.toContain(TOKEN_CONVITE_VALIDO);
      expect(chamadas[0].corpo).toEqual({ token: TOKEN_CONVITE_VALIDO });
      // o roteador também fica sem o `convite` (os outros parâmetros continuam)
      await waitFor(() => expect(buscaAtual()).toBe('?origem=email'));
      expect(rotaAtual()).toBe('/acesso');
    });

    it('no navegador, usa history.replaceState e a barra de endereço já está sem o token quando o POST sai', async () => {
      const enderecoNaHoraDoPost: string[] = [];
      server.use(
        http.post('*/api/portal/convites/validar', () => {
          enderecoNaHoraDoPost.push(window.location.href);
          return HttpResponse.json({
            cnpj: '12345678000195',
            razaoSocial: 'Exemplo Serviços de Engenharia Ltda',
            expiraEm: new Date(Date.now() + 86_400_000).toISOString(),
          });
        }),
      );
      const replaceState = vi.spyOn(window.history, 'replaceState');
      window.history.pushState(null, '', `/acesso?convite=${TOKEN_CONVITE_VALIDO}&origem=email`);
      render(<App />);

      // logo depois do primeiro render (efeitos já rodaram), antes de a resposta do convite chegar
      expect(window.location.search).toBe('?origem=email');

      expect(window.location.pathname).toBe('/acesso');
      expect(window.location.href).not.toContain(TOKEN_CONVITE_VALIDO);
      expect(replaceState).toHaveBeenCalled();
      expect(String(replaceState.mock.calls.at(-1)?.[2])).not.toContain(TOKEN_CONVITE_VALIDO);
      await waitFor(() => expect(screen.getByLabelText('CNPJ')).toHaveValue('12.345.678/0001-95'));
      expect(enderecoNaHoraDoPost).toHaveLength(1);
      expect(enderecoNaHoraDoPost[0]).not.toContain(TOKEN_CONVITE_VALIDO);
      expect(window.location.search).toBe('?origem=email');
    });

    it('não escreve o token no console', async () => {
      const espioes = (['log', 'info', 'warn', 'error', 'debug', 'trace'] as const).map((m) =>
        vi.spyOn(console, m),
      );
      renderizarPortal('/acesso?convite=link-adulterado-000000000000000000000000000');
      await screen.findByText('Este link não é mais válido.');
      renderizarPortal(`/acesso?convite=${TOKEN_CONVITE_VALIDO}`);
      await screen.findByText('Olá, Exemplo Serviços de Engenharia Ltda!');
      const saida = espioes
        .flatMap((e) => e.mock.calls.flat())
        .map(String)
        .join('\n');
      expect(saida).not.toContain(TOKEN_CONVITE_VALIDO);
      expect(saida).not.toContain('link-adulterado-000000000000000000000000000');
    });
  });

  it('link de convite expirado mostra que o link não é mais válido', async () => {
    // A API responde 404 CONVITE_INVALIDO para convite expirado, usado ou substituído.
    server.use(http.post('*/api/portal/convites/validar', () => problema(404, 'CONVITE_INVALIDO')));
    renderizarPortal(`/acesso?convite=${TOKEN_CONVITE_VALIDO}`);
    expect(await screen.findByText('Este link não é mais válido.')).toBeInTheDocument();
    expect(
      screen.getByText(/Se você já criou sua senha, é só entrar\. Se não, peça um novo convite/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('CNPJ')).toHaveValue('');
    await waitFor(() => expect(buscaAtual()).toBe(''));
  });

  it('limite de requisições ao validar o convite mostra o title do servidor', async () => {
    server.use(
      http.post('*/api/portal/convites/validar', () => problema(429, 'LIMITE_REQUISICOES')),
    );
    renderizarPortal(`/acesso?convite=${TOKEN_CONVITE_VALIDO}`);
    expect(await screen.findByText('Muitas tentativas. Aguarde um pouco.')).toBeInTheDocument();
  });

  it('link de convite inválido mostra a mensagem e deixa o CNPJ vazio', async () => {
    renderizarPortal('/acesso?convite=link-adulterado-000000000000000000000000000');
    expect(await screen.findByText('Este link não é mais válido.')).toBeInTheDocument();
    expect(screen.getByLabelText('CNPJ')).toHaveValue('');
  });

  it('aplica a máscara ao digitar, inclusive no CNPJ alfanumérico', async () => {
    const { user } = renderizarPortal('/acesso');
    await user.type(screen.getByLabelText('CNPJ'), '12abc34501de35');
    expect(screen.getByLabelText('CNPJ')).toHaveValue('12.ABC.345/01DE-35');
  });

  it('recusa CNPJ com dígito verificador errado sem chamar a API', async () => {
    let chamou = false;
    server.use(
      http.post('*/api/portal/auth/login', () => {
        chamou = true;
      }),
    );
    const { user } = renderizarPortal('/acesso');
    await entrar(user, '12345678000196', 'qualquer1');
    expect(await screen.findByText(/Confira o CNPJ/)).toBeInTheDocument();
    expect(screen.getByLabelText('CNPJ')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('CNPJ')).toHaveFocus();
    expect(chamou).toBe(false);
  });

  it('credenciais erradas mostram "CNPJ ou senha incorretos."', async () => {
    const { user } = renderizarPortal('/acesso');
    await entrar(user, CNPJ_EXEMPLO, 'Errada123');
    expect(await screen.findByRole('alert')).toHaveTextContent('CNPJ ou senha incorretos.');
    expect(rotaAtual()).toBe('/acesso');
  });

  it('convite expirado mostra a mensagem do contrato', async () => {
    const { user } = renderizarPortal('/acesso');
    await entrar(user, '12ABC34501DE35', SENHA_TEMPORARIA_EXEMPLO);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Seu convite expirou. Peça um novo convite à Jotanunes.',
    );
  });

  it('empresa desativada tem o acesso recusado', async () => {
    const { user } = renderizarPortal('/acesso');
    await entrar(user, '33444555000181', 'Gama2026ok');
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta empresa está desativada.');
  });

  it('depois de 5 senhas erradas, a 6ª tentativa mostra o bloqueio com o horário de liberação', async () => {
    const { user } = renderizarPortal('/acesso');
    for (let i = 0; i < 5; i++) {
      await entrar(user, EMPRESA_ALFA.cnpj, `Errada${i}x`);
      await screen.findByText('CNPJ ou senha incorretos.');
    }
    await entrar(user, EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    const alerta = await screen.findByText(/Muitas tentativas/);
    expect(alerta).toHaveTextContent(/Tente de novo às \d{2}:\d{2}\./);
    expect(rotaAtual()).toBe('/acesso');
  });

  it('mostra o title do servidor para limite de requisições', async () => {
    server.use(http.post('*/api/portal/auth/login', () => problema(429, 'LIMITE_REQUISICOES')));
    const { user } = renderizarPortal('/acesso');
    await entrar(user, CNPJ_EXEMPLO, 'Temp1234');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas tentativas. Aguarde um pouco.',
    );
  });

  it('login com troca pendente leva à troca de senha e impede abrir /documentos', async () => {
    const { user } = renderizarPortal(`/acesso?convite=${TOKEN_CONVITE_VALIDO}`);
    await waitFor(() => expect(screen.getByLabelText('CNPJ')).toHaveValue('12.345.678/0001-95'));
    await user.type(screen.getByLabelText('Senha'), SENHA_TEMPORARIA_EXEMPLO);
    await user.click(screen.getByRole('button', { name: 'Acessar' }));

    expect(
      await screen.findByRole('heading', { name: 'Crie uma nova senha para continuar.' }),
    ).toBeInTheDocument();
    expect(rotaAtual()).toBe('/trocar-senha');
  });

  it('empresa ativa vai direto para "Meus documentos"', async () => {
    const { user } = renderizarPortal('/acesso');
    await entrar(user, EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    expect(await screen.findByRole('heading', { name: 'Meus documentos' })).toBeInTheDocument();
    expect(rotaAtual()).toBe('/documentos');
    expect(banco.empresas[1].tentativasFalhas).toBe(0);
  });

  it('sem sessão, qualquer rota protegida volta para o acesso', () => {
    renderizarPortal('/documentos');
    expect(rotaAtual()).toBe('/acesso');
  });
});
