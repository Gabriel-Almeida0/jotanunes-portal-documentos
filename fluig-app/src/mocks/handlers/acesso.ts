/**
 * Login próprio da área Jotanunes (contrato 1.2.0, research R17): configuração, login, troca de
 * senha e sair. Usuários de exemplo (quickstart §5): `admin.mock`/`Admin1234`, `comum.mock`/`Comum1234`,
 * `novo.mock`/`Temp1234` (troca obrigatória), `inativo.mock` (desativado) e `expirado.mock`/`Temp1234`
 * (senha provisória vencida).
 */
import { http, HttpResponse } from 'msw';
import type { SessaoJotanunes } from '../../api/tipos';
import {
  agora,
  agoraIso,
  db,
  loginLocalMock,
  paraUsuarioFluig,
  tentativasLoginInexistente,
  tokenLocal,
  type UsuarioInternoDb,
} from '../dados';
import { API, adicionarErro, latencia, problema, sessaoDe, validacao } from '../util';

/** 5 falhas seguidas → bloqueio de 15 min (mesmas constantes do portal). */
const MAXIMO_FALHAS = 5;
const BLOQUEIO_MS = 15 * 60_000;

function sessao(u: UsuarioInternoDb): SessaoJotanunes {
  return {
    accessToken: tokenLocal(u),
    expiraEm: new Date(agora().getTime() + 8 * 3_600_000).toISOString(),
    usuario: paraUsuarioFluig(u),
  };
}

function bloqueadoAgora(bloqueadoAte: string | null): boolean {
  return Boolean(bloqueadoAte && new Date(bloqueadoAte).getTime() > agora().getTime());
}

/** Soma uma falha; na 5ª seguida, zera o contador e bloqueia por 15 minutos. */
function proximaFalha(falhas: number): { falhas: number; bloqueadoAte: string | null } {
  const total = falhas + 1;
  if (total < MAXIMO_FALHAS) return { falhas: total, bloqueadoAte: null };
  return { falhas: 0, bloqueadoAte: new Date(agora().getTime() + BLOQUEIO_MS).toISOString() };
}

function senhaForte(senha: string): boolean {
  return senha.length >= 8 && senha.length <= 128 && /\p{L}/u.test(senha) && /\d/.test(senha);
}

export const handlersAcesso = [
  http.get(`${API}/auth/configuracao`, async () => {
    await latencia();
    return HttpResponse.json(
      { loginLocalHabilitado: loginLocalMock() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }),

  http.post(`${API}/auth/login`, async ({ request }) => {
    await latencia();
    if (!loginLocalMock()) return problema('NAO_ENCONTRADO');
    const corpo = (await request.json().catch(() => ({}))) as { login?: unknown; senha?: unknown };
    const login = typeof corpo.login === 'string' ? corpo.login.trim().toLowerCase() : '';
    const senha = typeof corpo.senha === 'string' ? corpo.senha : '';
    const errors: Record<string, string[]> = {};
    if (!login) adicionarErro(errors, 'login', 'Informe o login.');
    if (!senha) adicionarErro(errors, 'senha', 'Informe a senha.');
    if (Object.keys(errors).length) return validacao(errors);

    const u = db.usuarios.find((x) => x.login === login);
    if (!u) {
      // Login inexistente: mesma sequência de respostas de um login existente (FR-104).
      const t = tentativasLoginInexistente.get(login) ?? { falhas: 0, bloqueadoAte: null };
      if (bloqueadoAgora(t.bloqueadoAte)) return problema('ACESSO_BLOQUEADO', { bloqueadoAte: t.bloqueadoAte });
      tentativasLoginInexistente.set(login, proximaFalha(t.falhas));
      return problema('LOGIN_INVALIDO');
    }
    if (bloqueadoAgora(u.bloqueadoAte)) return problema('ACESSO_BLOQUEADO', { bloqueadoAte: u.bloqueadoAte });
    if (u.senha !== senha) {
      const falha = proximaFalha(u.tentativasFalhas);
      u.tentativasFalhas = falha.falhas;
      u.bloqueadoAte = falha.bloqueadoAte;
      return problema('LOGIN_INVALIDO');
    }
    if (!u.ativo) return problema('USUARIO_INATIVO');
    if (
      u.trocaSenhaObrigatoria &&
      (!u.senhaProvisoriaExpiraEm || new Date(u.senhaProvisoriaExpiraEm).getTime() <= agora().getTime())
    ) {
      return problema('SENHA_PROVISORIA_EXPIRADA');
    }
    u.tentativasFalhas = 0;
    u.bloqueadoAte = null;
    u.ultimoAcessoEm = agoraIso();
    return HttpResponse.json(sessao(u));
  }),

  http.post(`${API}/auth/trocar-senha`, async ({ request }) => {
    await latencia();
    if (!loginLocalMock()) return problema('NAO_ENCONTRADO');
    const atual = sessaoDe(request);
    if (!atual) return problema('NAO_AUTENTICADO');
    const u = db.usuarios.find((x) => x.id === atual.usuarioInternoId);
    if (!u) return problema('SO_LOGIN_LOCAL');
    const corpo = (await request.json().catch(() => ({}))) as { senhaAtual?: unknown; novaSenha?: unknown };
    const senhaAtual = typeof corpo.senhaAtual === 'string' ? corpo.senhaAtual : '';
    const novaSenha = typeof corpo.novaSenha === 'string' ? corpo.novaSenha : '';
    const errors: Record<string, string[]> = {};
    if (!senhaAtual) adicionarErro(errors, 'senhaAtual', 'Informe a senha atual.');
    if (!novaSenha) adicionarErro(errors, 'novaSenha', 'Informe a nova senha.');
    if (Object.keys(errors).length) return validacao(errors);
    if (senhaAtual !== u.senha) return problema('SENHA_ATUAL_INCORRETA');
    if (!senhaForte(novaSenha) || novaSenha === senhaAtual) return problema('SENHA_FRACA');
    u.senha = novaSenha;
    u.trocaSenhaObrigatoria = false;
    u.senhaProvisoriaExpiraEm = null;
    u.versao += 1;
    return HttpResponse.json(sessao(u));
  }),

  http.post(`${API}/auth/sair`, async ({ request }) => {
    await latencia();
    if (!loginLocalMock()) return problema('NAO_ENCONTRADO');
    const atual = sessaoDe(request);
    if (!atual) return problema('NAO_AUTENTICADO');
    // Token do login próprio: a versão sobe e o token deixa de valer. Token do Fluig: nada a fazer.
    const u = db.usuarios.find((x) => x.id === atual.usuarioInternoId);
    if (u && request.headers.get('authorization')?.includes('local:')) u.versao += 1;
    return new HttpResponse(null, { status: 204 });
  }),
];
