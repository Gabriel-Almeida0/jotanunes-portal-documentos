/**
 * Mocks do login próprio e dos usuários internos (T166): seguem o contrato 1.2.0 e as regras do
 * research R17 (bloqueio na 6ª tentativa, revogação por versão, regras do último administrador).
 */
import { IDS, db, definirLoginLocalMock, definirPerfilMock, definirSessaoMock } from './dados';

const BASE = 'http://localhost/api/fluig';

function chamar(metodo: string, caminho: string, corpo?: unknown, token: string | null = 'token-de-teste') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

async function entrar(login: string, senha: string) {
  const r = await chamar('POST', '/auth/login', { login, senha }, null);
  return { status: r.status, corpo: await r.json() };
}

describe('mocks — login próprio', () => {
  it('configuração diz se o login próprio está ligado', async () => {
    expect(await (await chamar('GET', '/auth/configuracao', undefined, null)).json()).toEqual({ loginLocalHabilitado: true });
    definirLoginLocalMock(false);
    expect(await (await chamar('GET', '/auth/configuracao', undefined, null)).json()).toEqual({ loginLocalHabilitado: false });
  });

  it('login do administrador devolve a sessão com origem LOGIN_LOCAL e o token vale em /me', async () => {
    const { status, corpo } = await entrar('  ADMIN.mock ', 'Admin1234');
    expect(status).toBe(200);
    expect(corpo.usuario).toEqual(expect.objectContaining({ login: 'admin.mock', admin: true, origem: 'LOGIN_LOCAL', trocaSenhaObrigatoria: false }));
    const me = await (await chamar('GET', '/me', undefined, corpo.accessToken)).json();
    expect(me.origem).toBe('LOGIN_LOCAL');
  });

  it('respostas de recusa: senha errada, desativado, provisória expirada', async () => {
    expect((await entrar('admin.mock', 'errada1')).corpo.code).toBe('LOGIN_INVALIDO');
    expect((await entrar('inativo.mock', 'Inativo1234')).corpo.code).toBe('USUARIO_INATIVO');
    expect((await entrar('expirado.mock', 'Temp1234')).corpo.code).toBe('SENHA_PROVISORIA_EXPIRADA');
  });

  it('5 falhas bloqueiam: a 6ª tentativa recebe 423 com bloqueadoAte (também para login inexistente)', async () => {
    for (const login of ['comum.mock', 'nao.existe']) {
      for (let i = 0; i < 5; i += 1) expect((await entrar(login, 'errada1')).status).toBe(401);
      const sexta = await entrar(login, login === 'comum.mock' ? 'Comum1234' : 'errada1');
      expect(sexta.status).toBe(423);
      expect(sexta.corpo.code).toBe('ACESSO_BLOQUEADO');
      expect(new Date(sexta.corpo.bloqueadoAte).getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('senha provisória: só /me e trocar-senha respondem até a troca; depois o token antigo cai', async () => {
    const { corpo } = await entrar('novo.mock', 'Temp1234');
    const token = corpo.accessToken as string;
    expect(corpo.usuario.trocaSenhaObrigatoria).toBe(true);
    expect((await (await chamar('GET', '/painel', undefined, token)).json()).code).toBe('TROCA_SENHA_OBRIGATORIA');
    expect((await (await chamar('POST', '/auth/trocar-senha', { senhaAtual: 'x', novaSenha: 'Nova1234' }, token)).json()).code).toBe('SENHA_ATUAL_INCORRETA');
    expect((await (await chamar('POST', '/auth/trocar-senha', { senhaAtual: 'Temp1234', novaSenha: 'fraca' }, token)).json()).code).toBe('SENHA_FRACA');
    const trocou = await (await chamar('POST', '/auth/trocar-senha', { senhaAtual: 'Temp1234', novaSenha: 'Nova1234' }, token)).json();
    expect(trocou.usuario.trocaSenhaObrigatoria).toBe(false);
    expect((await chamar('GET', '/me', undefined, token)).status).toBe(401);
    expect((await chamar('GET', '/painel', undefined, trocou.accessToken)).status).toBe(200);
  });

  it('sair revoga o token do login próprio', async () => {
    const { corpo } = await entrar('comum.mock', 'Comum1234');
    expect((await chamar('POST', '/auth/sair', undefined, corpo.accessToken)).status).toBe(204);
    expect((await chamar('GET', '/me', undefined, corpo.accessToken)).status).toBe(401);
  });
});

describe('mocks — usuários internos', () => {
  it('usuário comum recebe 403 SEM_PERMISSAO em todas as rotas', async () => {
    definirPerfilMock('comum');
    const rotas: Array<[string, string, unknown]> = [
      ['GET', '/usuarios', undefined],
      ['POST', '/usuarios', { login: 'x.y', nome: 'Xis', email: 'x@y.com' }],
      ['GET', `/usuarios/${IDS.usuarioComum}`, undefined],
      ['PUT', `/usuarios/${IDS.usuarioComum}`, { nome: 'Xis', email: 'x@y.com', admin: true, ativo: true }],
      ['POST', `/usuarios/${IDS.usuarioComum}/redefinir-senha`, undefined],
    ];
    for (const [metodo, caminho, corpo] of rotas) {
      expect((await (await chamar(metodo, caminho, corpo)).json()).code).toBe('SEM_PERMISSAO');
    }
    expect(db.usuarios.find((u) => u.id === IDS.usuarioComum)?.admin).toBe(false);
  });

  it('cria (sem senha na resposta), recusa login repetido e falha de e-mail sem gravar', async () => {
    const r = await chamar('POST', '/usuarios', { login: 'Bia.Nova', nome: 'Bia Nova', email: 'bia@jotanunes.com' });
    expect(r.status).toBe(201);
    const criado = await r.json();
    expect(criado).toEqual(expect.objectContaining({ login: 'bia.nova', situacao: 'AGUARDANDO_PRIMEIRO_ACESSO', admin: false }));
    expect(JSON.stringify(criado)).not.toContain('Temp1234');
    expect((await (await chamar('POST', '/usuarios', { login: 'BIA.NOVA', nome: 'Outra', email: 'o@j.com' })).json()).code).toBe('LOGIN_DUPLICADO');
    const total = db.usuarios.length;
    expect((await (await chamar('POST', '/usuarios', { login: 'falhou', nome: 'Falhou', email: 'f@falha.test' })).json()).code).toBe('EMAIL_ACESSO_FALHOU');
    expect(db.usuarios.length).toBe(total);
  });

  it('não deixa zerar os administradores nem tirar o próprio acesso', async () => {
    const admin = db.usuarios.find((u) => u.id === IDS.usuarioAdmin)!;
    const dados = { nome: admin.nome, email: admin.email, admin: true, ativo: false };
    expect((await (await chamar('PUT', `/usuarios/${IDS.usuarioAdmin}`, dados)).json()).code).toBe('ULTIMO_ADMINISTRADOR');
    definirSessaoMock({ origem: 'LOGIN_LOCAL' });
    expect((await (await chamar('PUT', `/usuarios/${IDS.usuarioAdmin}`, dados)).json()).code).toBe('ALTERACAO_PROPRIA_NAO_PERMITIDA');
    expect(admin.ativo).toBe(true);
  });

  it('redefinir senha: usuário desativado → 409 USUARIO_INATIVO; ativo → aguardando primeiro acesso', async () => {
    const inativo = await chamar('POST', `/usuarios/${IDS.usuarioInativo}/redefinir-senha`);
    expect(inativo.status).toBe(409);
    expect((await inativo.json()).code).toBe('USUARIO_INATIVO');
    const ok = await (await chamar('POST', `/usuarios/${IDS.usuarioComum}/redefinir-senha`)).json();
    expect(ok.situacao).toBe('AGUARDANDO_PRIMEIRO_ACESSO');
  });
});
