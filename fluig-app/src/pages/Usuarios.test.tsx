import { screen, waitFor, within } from '@testing-library/react';
import { IDS, db, definirPerfilMock, definirSessaoMock } from '../mocks/dados';
import { server } from '../mocks/server';
import { renderizarRota } from '../test/renderizar';

type Usuario = ReturnType<typeof renderizarRota>['usuario'];

async function abrir() {
  const r = renderizarRota('/usuarios');
  await screen.findByRole('cell', { name: /Ana Administradora/ });
  return r;
}

function linha(nome: string) {
  const celula = screen.getByRole('cell', { name: new RegExp(nome) });
  return celula.closest('tr') as HTMLElement;
}

async function preencherNovo(usuario: Usuario, dados: { nome: string; email: string; login: string; admin?: boolean }) {
  await usuario.click(screen.getByRole('button', { name: 'Novo usuário' }));
  const dialogo = await screen.findByRole('dialog', { name: 'Novo usuário' });
  await usuario.type(within(dialogo).getByLabelText(/^Nome/), dados.nome);
  await usuario.type(within(dialogo).getByLabelText(/^E-mail/), dados.email);
  await usuario.type(within(dialogo).getByLabelText(/^Login/), dados.login);
  if (dados.admin) await usuario.click(within(dialogo).getByLabelText('Administrador'));
  await usuario.click(within(dialogo).getByRole('button', { name: 'Cadastrar' }));
  return dialogo;
}

describe('Usuários (gestão de usuários internos)', () => {
  it('lista nome, login, e-mail, perfil em texto, situação em texto e último acesso', async () => {
    await abrir();
    expect(screen.getByRole('heading', { level: 1, name: 'Usuários' })).toBeInTheDocument();
    const ana = linha('Ana Administradora');
    expect(within(ana).getByText('admin.mock')).toBeInTheDocument();
    expect(within(ana).getByText('ana.admin@jotanunes.com')).toBeInTheDocument();
    expect(within(ana).getByText('Administrador')).toBeInTheDocument();
    expect(within(ana).getByText('Ativo')).toBeInTheDocument();
    expect(within(linha('Carlos Comum')).getByText('Comum')).toBeInTheDocument();
    expect(within(linha('Nina Nova')).getByText('Aguardando primeiro acesso')).toBeInTheDocument();
    expect(within(linha('Nina Nova')).getByText('Nunca entrou')).toBeInTheDocument();
    expect(within(linha('Eva Expirada')).getByText('Senha provisória expirada')).toBeInTheDocument();
    expect(within(linha('Igor Inativo')).getByText('Desativado')).toBeInTheDocument();
  });

  it('filtra por busca, situação e perfil', async () => {
    const { usuario } = await abrir();
    await usuario.selectOptions(screen.getByLabelText('Situação'), 'desativados');
    await usuario.click(screen.getByRole('button', { name: 'Pesquisar' }));
    await waitFor(() => expect(screen.queryByRole('cell', { name: /Ana Administradora/ })).not.toBeInTheDocument());
    expect(screen.getByRole('cell', { name: /Igor Inativo/ })).toBeInTheDocument();

    await usuario.selectOptions(screen.getByLabelText('Situação'), 'todos');
    await usuario.selectOptions(screen.getByLabelText('Perfil'), 'administradores');
    await usuario.type(screen.getByLabelText('Buscar'), 'ana');
    await usuario.click(screen.getByRole('button', { name: 'Pesquisar' }));
    expect(await screen.findByRole('cell', { name: /Ana Administradora/ })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: /Carlos Comum/ })).not.toBeInTheDocument();
  });

  it('cadastra: mostra a mensagem com o e-mail e o usuário aparece na lista', async () => {
    const { usuario } = await abrir();
    await preencherNovo(usuario, { nome: 'Bia Nova', email: 'bia@jotanunes.com', login: 'bia.nova', admin: true });

    expect(await screen.findByText('Pronto. Enviamos a senha provisória para bia@jotanunes.com.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await screen.findByRole('cell', { name: /Bia Nova/ });
    const bia = linha('Bia Nova');
    expect(within(bia).getByText('Aguardando primeiro acesso')).toBeInTheDocument();
    expect(within(bia).getByText('Administrador')).toBeInTheDocument();
    expect(screen.queryByText(/Temp1234/)).not.toBeInTheDocument();
  });

  it('valida no cliente o formato do login e o nome', async () => {
    const { usuario } = await abrir();
    const dialogo = await preencherNovo(usuario, { nome: 'Bi', email: 'bia@jotanunes.com', login: 'bia nova' });
    expect(within(dialogo).getByText('Informe o nome (de 3 a 150 caracteres).')).toBeInTheDocument();
    expect(
      within(dialogo).getByText('Use de 3 a 100 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.'),
    ).toBeInTheDocument();
  });

  it('LOGIN_DUPLICADO aparece no campo login', async () => {
    const { usuario } = await abrir();
    const dialogo = await preencherNovo(usuario, { nome: 'Outro Carlos', email: 'c2@jotanunes.com', login: 'COMUM.mock' });
    expect(await within(dialogo).findByText('Já existe um usuário com este login.')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText(/^Login/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('EMAIL_ACESSO_FALHOU é exibido mantendo os dados do formulário', async () => {
    const { usuario } = await abrir();
    const dialogo = await preencherNovo(usuario, { nome: 'Fábio Falha', email: 'fabio@falha.test', login: 'fabio' });
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      'Não conseguimos enviar o e-mail com a senha provisória. Tente de novo em alguns minutos.',
    );
    expect(within(dialogo).getByLabelText(/^Nome/)).toHaveValue('Fábio Falha');
    expect(within(dialogo).getByLabelText(/^Login/)).toHaveValue('fabio');
  });

  it('edita nome e e-mail com o login só leitura', async () => {
    const { usuario } = await abrir();
    await usuario.click(screen.getByRole('button', { name: 'Editar Carlos Comum' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Editar usuário' });
    expect(within(dialogo).getByText('comum.mock')).toBeInTheDocument();
    expect(within(dialogo).queryByLabelText(/^Login/)).not.toBeInTheDocument();
    const nome = within(dialogo).getByLabelText(/^Nome/);
    await usuario.clear(nome);
    await usuario.type(nome, 'Carlos Comum Silva');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('cell', { name: /Carlos Comum Silva/ })).toBeInTheDocument();
    expect(screen.getByText('Alterações em "Carlos Comum Silva" salvas.')).toBeInTheDocument();
  });

  it('desativa com confirmação e o selo muda', async () => {
    const { usuario } = await abrir();
    await usuario.click(screen.getByRole('button', { name: 'Desativar Carlos Comum' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Desativar usuário?' });
    expect(within(dialogo).getByText(/A pessoa perde o acesso na hora. Continuar\?/)).toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Desativar' }));

    await waitFor(() => expect(within(linha('Carlos Comum')).getByText('Desativado')).toBeInTheDocument());
    expect(within(linha('Carlos Comum')).getByRole('button', { name: 'Reativar Carlos Comum' })).toBeInTheDocument();
  });

  it('ULTIMO_ADMINISTRADOR é exibido na confirmação e nada muda', async () => {
    const { usuario } = await abrir();
    await usuario.click(screen.getByRole('button', { name: 'Desativar Ana Administradora' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Desativar usuário?' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Desativar' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      'O sistema precisa de pelo menos um administrador ativo.',
    );
    expect(within(linha('Ana Administradora')).getByText('Ativo')).toBeInTheDocument();
  });

  it('redefinir senha pede confirmação com o nome e avisa o envio', async () => {
    const { usuario } = await abrir();
    await usuario.click(screen.getByRole('button', { name: 'Redefinir senha de Carlos Comum' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Redefinir senha?' });
    expect(dialogo).toHaveTextContent(
      'Carlos Comum recebe por e-mail uma nova senha provisória. A senha atual e as sessões abertas deixam de valer. Continuar?',
    );
    await usuario.click(within(dialogo).getByRole('button', { name: 'Redefinir senha' }));

    expect(await screen.findByText('Pronto. Enviamos a nova senha provisória para carlos.comum@jotanunes.com.')).toBeInTheDocument();
    expect(within(linha('Carlos Comum')).getByText('Aguardando primeiro acesso')).toBeInTheDocument();
  });

  it('na própria linha (login próprio) não há "Desativar" e o perfil é só leitura', async () => {
    definirSessaoMock({ origem: 'LOGIN_LOCAL' });
    const { usuario } = await abrir();
    const ana = linha('Ana Administradora');
    expect(within(ana).queryByRole('button', { name: /Desativar/ })).not.toBeInTheDocument();
    expect(within(ana).getByText('Você')).toBeInTheDocument();

    await usuario.click(within(ana).getByRole('button', { name: 'Editar Ana Administradora' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Editar usuário' });
    expect(within(dialogo).getByLabelText('Administrador')).toBeDisabled();
    expect(within(dialogo).getByText('Você não pode tirar o seu próprio acesso de administrador.')).toBeInTheDocument();

    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    await usuario.click(within(ana).getByRole('button', { name: 'Redefinir senha de Ana Administradora' }));
    const confirmacao = await screen.findByRole('dialog', { name: 'Redefinir senha?' });
    expect(confirmacao).toHaveTextContent('A sua sessão vai terminar');
  });

  it('SEM_PERMISSAO fecha o formulário e mostra a mensagem mantendo a lista', async () => {
    const { usuario } = await abrir();
    definirPerfilMock('comum');
    await preencherNovo(usuario, { nome: 'Bia Nova', email: 'bia@jotanunes.com', login: 'bia.nova' });
    expect(await screen.findByText('Só administradores podem fazer isso. Se você precisa, fale com a TI.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: /Ana Administradora/ })).toBeInTheDocument();
  });

  it('usuário comum em /usuarios vê só o aviso e a API de usuários não é chamada', async () => {
    definirPerfilMock('comum');
    const chamadas: string[] = [];
    server.events.on('request:start', ({ request }) => chamadas.push(request.url));
    try {
      renderizarRota('/usuarios');
      expect(await screen.findByRole('heading', { level: 1, name: 'Usuários' })).toBeInTheDocument();
      expect(
        screen.getByText('Só administradores podem cadastrar, alterar ou analisar. Se você precisa, fale com a TI.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Novo usuário' })).not.toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 50));
      expect(chamadas.filter((u) => u.includes('/api/fluig/usuarios'))).toEqual([]);
    } finally {
      server.events.removeAllListeners();
    }
    expect(db.usuarios.find((u) => u.id === IDS.usuarioAdmin)?.ativo).toBe(true);
  });
});
