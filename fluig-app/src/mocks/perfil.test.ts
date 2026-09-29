/**
 * Mocks por perfil (T137): `/me` informa `admin` e as 10 operações `x-requer-admin` do contrato
 * respondem 403 `SEM_PERMISSAO` quando o perfil do mock é comum. Convites e consultas continuam
 * liberados.
 */
import { IDS, db, definirPerfilMock, perfilMock } from './dados';

const BASE = 'http://localhost/api/fluig';
const TITULO = 'Só administradores podem fazer isso. Se você precisa, fale com a TI.';

function chamar(metodo: string, caminho: string, corpo?: unknown, token = 'token-de-teste') {
  return fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
}

function envioEmAnalise(): string {
  const envio = db.envios.find((e) => e.status === 'EM_ANALISE');
  if (!envio) throw new Error('semente sem envio em análise');
  return envio.id;
}

/** As 10 operações com `x-requer-admin: true` no contrato 1.1.0. */
function operacoesDeAdmin(): Array<[string, string, unknown]> {
  return [
    ['POST', '/obras', { nome: 'Obra Nova', cidade: 'Aracaju', uf: 'SE' }],
    ['PUT', `/obras/${IDS.obraVistaDoRio}`, { nome: 'Outra', cidade: 'Aracaju', uf: 'SE', ativa: true }],
    ['PUT', `/obras/${IDS.obraVistaDoRio}/empresas/${IDS.empresaGama}`, undefined],
    ['DELETE', `/obras/${IDS.obraVistaDoRio}/empresas/${IDS.empresaAlfa}`, undefined],
    ['POST', '/empresas', { razaoSocial: 'Nova Ltda', cnpj: '11222333000181', emailContato: 'a@b.com' }],
    ['PUT', `/empresas/${IDS.empresaAlfa}`, { razaoSocial: 'Alfa', cnpj: '11222333000181', emailContato: 'a@b.com', ativa: true }],
    ['POST', '/tipos-documento', { nome: 'Tipo Novo' }],
    ['PUT', `/tipos-documento/${IDS.tipoAso}`, { nome: 'ASO', ativo: false }],
    ['POST', `/envios/${envioEmAnalise()}/aprovar`, undefined],
    ['POST', `/envios/${envioEmAnalise()}/rejeitar`, { motivo: 'Documento ilegível.' }],
  ];
}

describe('mocks por perfil', () => {
  it('o perfil padrão é administrador e /me devolve admin=true', async () => {
    expect(perfilMock()).toBe('admin');
    const me = await (await chamar('GET', '/me')).json();
    expect(me).toEqual(expect.objectContaining({ admin: true }));
  });

  it('com perfil comum /me devolve admin=false', async () => {
    definirPerfilMock('comum');
    const me = await (await chamar('GET', '/me')).json();
    expect(me.admin).toBe(false);
    expect(Object.keys(me).sort()).toEqual(['admin', 'email', 'login', 'nome']);
  });

  it('com perfil comum as 10 operações de administrador respondem 403 SEM_PERMISSAO sem mudar nada', async () => {
    definirPerfilMock('comum');
    const antes = JSON.stringify(db);
    for (const [metodo, caminho, corpo] of operacoesDeAdmin()) {
      const resposta = await chamar(metodo, caminho, corpo);
      expect(resposta.status, `${metodo} ${caminho}`).toBe(403);
      expect(resposta.headers.get('content-type')).toContain('application/problem+json');
      const problema = await resposta.json();
      expect(problema).toEqual(expect.objectContaining({ code: 'SEM_PERMISSAO', status: 403, title: TITULO }));
    }
    expect(JSON.stringify(db)).toBe(antes);
  });

  it('com perfil comum, 403 vem antes de validação e de 404', async () => {
    definirPerfilMock('comum');
    const resposta = await chamar('PUT', '/tipos-documento/00000000-0000-4000-8000-ffffffffffff', {});
    expect(resposta.status).toBe(403);
  });

  it('sem token continua 401 (não 403)', async () => {
    definirPerfilMock('comum');
    const resposta = await fetch(`${BASE}/tipos-documento`, { method: 'POST', body: '{}' });
    expect(resposta.status).toBe(401);
  });

  it('com perfil comum, convites e consultas continuam liberados', async () => {
    definirPerfilMock('comum');
    expect((await chamar('POST', `/empresas/${IDS.empresaGama}/convites`)).status).toBe(201);
    for (const caminho of ['/painel', '/obras', '/empresas', '/tipos-documento', '/envios', `/empresas/${IDS.empresaAlfa}/documentos`]) {
      expect((await chamar('GET', caminho)).status, caminho).toBe(200);
    }
  });

  it('com perfil admin as operações de administrador funcionam', async () => {
    for (const [metodo, caminho, corpo] of operacoesDeAdmin().slice(0, 1)) {
      expect((await chamar(metodo, caminho, corpo)).status).toBe(201);
    }
    expect((await chamar('POST', `/envios/${envioEmAnalise()}/aprovar`)).status).toBe(200);
  });
});
