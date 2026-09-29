/**
 * Usuários internos (contrato 1.2.0, `/api/fluig/usuarios*`): todas as rotas exigem administrador.
 * Para simular a falha do e-mail de acesso (502 `EMAIL_ACESSO_FALHOU`), use um e-mail do domínio
 * `falha.test` (ex.: `fulano@falha.test`). A senha provisória do mock é sempre `Temp1234`.
 */
import { http, HttpResponse } from 'msw';
import {
  SENHA_PROVISORIA_MOCK,
  agoraIso,
  daqui,
  db,
  novoId,
  paraUsuarioInterno,
  type UsuarioInternoDb,
} from '../dados';
import {
  API,
  adicionarErro,
  booleano,
  exigirAdmin,
  exigirFluig,
  latencia,
  paginar,
  problema,
  sessaoDe,
  simplificar,
  validacao,
} from '../util';

const FORMATO_LOGIN = /^[A-Za-z0-9._-]{3,100}$/;
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailFalha(email: string): boolean {
  return email.toLowerCase().endsWith('@falha.test');
}

function validarDados(corpo: Record<string, unknown>, comLogin: boolean): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
  const email = typeof corpo.email === 'string' ? corpo.email.trim() : '';
  if (nome.length < 3 || nome.length > 150) adicionarErro(errors, 'nome', 'Informe o nome (de 3 a 150 caracteres).');
  if (!FORMATO_EMAIL.test(email) || email.length > 254) adicionarErro(errors, 'email', 'Informe um e-mail válido.');
  if (comLogin) {
    const login = typeof corpo.login === 'string' ? corpo.login.trim() : '';
    if (!FORMATO_LOGIN.test(login)) {
      adicionarErro(errors, 'login', 'Use de 3 a 100 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.');
    }
  }
  return errors;
}

function administradoresAtivos(): UsuarioInternoDb[] {
  return db.usuarios.filter((u) => u.admin && u.ativo);
}

function provisoria(u: UsuarioInternoDb): void {
  u.senha = SENHA_PROVISORIA_MOCK;
  u.trocaSenhaObrigatoria = true;
  u.senhaProvisoriaExpiraEm = daqui(7);
  u.tentativasFalhas = 0;
  u.bloqueadoAte = null;
}

export const handlersUsuarios = [
  http.get(`${API}/usuarios`, async ({ request }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin(request);
    if (negado) return negado;
    const url = new URL(request.url);
    const busca = simplificar(url.searchParams.get('busca'));
    const ativo = booleano(url.searchParams.get('ativo'));
    const admin = booleano(url.searchParams.get('admin'));
    const lista = db.usuarios
      .filter((u) => (ativo === undefined ? true : u.ativo === ativo))
      .filter((u) => (admin === undefined ? true : u.admin === admin))
      .filter((u) => !busca || [u.nome, u.login, u.email].some((c) => simplificar(c).includes(busca)))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map(paraUsuarioInterno);
    const pagina = paginar(lista, url);
    return pagina instanceof HttpResponse ? pagina : HttpResponse.json(pagina);
  }),

  http.post(`${API}/usuarios`, async ({ request }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin(request);
    if (negado) return negado;
    const corpo = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    const errors = validarDados(corpo, true);
    if (Object.keys(errors).length) return validacao(errors);
    const login = String(corpo.login).trim().toLowerCase();
    if (db.usuarios.some((u) => u.login === login)) return problema('LOGIN_DUPLICADO');
    const email = String(corpo.email).trim().toLowerCase();
    if (emailFalha(email)) return problema('EMAIL_ACESSO_FALHOU');
    const autor = sessaoDe(request)?.usuario.login ?? 'sistema';
    const novo: UsuarioInternoDb = {
      id: novoId(),
      login,
      nome: String(corpo.nome).trim(),
      email,
      admin: corpo.admin === true,
      ativo: true,
      senha: SENHA_PROVISORIA_MOCK,
      trocaSenhaObrigatoria: true,
      senhaProvisoriaExpiraEm: daqui(7),
      versao: 0,
      tentativasFalhas: 0,
      bloqueadoAte: null,
      ultimoAcessoEm: null,
      criadoEm: agoraIso(),
      criadoPor: autor,
      atualizadoEm: null,
    };
    db.usuarios.push(novo);
    return HttpResponse.json(paraUsuarioInterno(novo), {
      status: 201,
      headers: { Location: `/api/fluig/usuarios/${novo.id}` },
    });
  }),

  http.get(`${API}/usuarios/:usuarioId`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin(request);
    if (negado) return negado;
    const u = db.usuarios.find((x) => x.id === params.usuarioId);
    return u ? HttpResponse.json(paraUsuarioInterno(u)) : problema('NAO_ENCONTRADO');
  }),

  http.put(`${API}/usuarios/:usuarioId`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin(request);
    if (negado) return negado;
    const corpo = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    const errors = validarDados(corpo, false);
    if (typeof corpo.admin !== 'boolean') adicionarErro(errors, 'admin', 'Informe o perfil.');
    if (typeof corpo.ativo !== 'boolean') adicionarErro(errors, 'ativo', 'Informe se o usuário está ativo.');
    if (Object.keys(errors).length) return validacao(errors);
    const u = db.usuarios.find((x) => x.id === params.usuarioId);
    if (!u) return problema('NAO_ENCONTRADO');
    const admin = corpo.admin as boolean;
    const ativo = corpo.ativo as boolean;
    const proprio = sessaoDe(request)?.usuarioInternoId === u.id;
    if (proprio && (!admin || !ativo)) return problema('ALTERACAO_PROPRIA_NAO_PERMITIDA');
    const restantes = administradoresAtivos().filter((x) => x.id !== u.id).length + (admin && ativo ? 1 : 0);
    if (restantes === 0) return problema('ULTIMO_ADMINISTRADOR');
    if (u.admin !== admin || u.ativo !== ativo) u.versao += 1;
    u.nome = String(corpo.nome).trim();
    u.email = String(corpo.email).trim().toLowerCase();
    u.admin = admin;
    u.ativo = ativo;
    u.atualizadoEm = agoraIso();
    return HttpResponse.json(paraUsuarioInterno(u));
  }),

  http.post(`${API}/usuarios/:usuarioId/redefinir-senha`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin(request);
    if (negado) return negado;
    const u = db.usuarios.find((x) => x.id === params.usuarioId);
    if (!u) return problema('NAO_ENCONTRADO');
    if (!u.ativo) return problema('USUARIO_INATIVO', { status: 409 });
    if (emailFalha(u.email)) return problema('EMAIL_ACESSO_FALHOU');
    provisoria(u);
    u.versao += 1;
    u.atualizadoEm = agoraIso();
    return HttpResponse.json(paraUsuarioInterno(u));
  }),
];
