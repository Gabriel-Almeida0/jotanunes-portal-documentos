import { delay, http, HttpResponse } from 'msw';
import type {
  ConviteValidacao,
  EmpresaPortal,
  LoginInput,
  SessaoPortal,
  TrocaSenhaInput,
} from '../../api/tipos';
import { autenticar } from '../autenticacao';
import { banco, emitirToken, type EmpresaMock } from '../dados';
import { problema } from '../problema';

const OITO_HORAS = 8 * 3_600_000;
const QUINZE_MINUTOS = 15 * 60_000;
const MAX_TENTATIVAS = 5;

function sessao(emp: EmpresaMock): SessaoPortal {
  return {
    accessToken: emitirToken(emp),
    expiraEm: new Date(Date.now() + OITO_HORAS).toISOString(),
    empresa: { ...emp.empresa },
  };
}

function normalizar(cnpj: string): string {
  return cnpj.replace(/[.\-/\s]/g, '').toUpperCase();
}

function senhaForte(senha: string): boolean {
  return senha.length >= 8 && senha.length <= 128 && /[A-Za-z]/.test(senha) && /\d/.test(senha);
}

/** Handlers de "Portal - Acesso" (convite, login, troca de senha, empresa atual). */
export const handlersAcesso = [
  http.get<{ token: string }>('*/api/portal/convites/:token', async ({ params }) => {
    await delay();
    const empresaId = banco.convites.get(params.token);
    const emp = banco.empresas.find((e) => e.empresa.id === empresaId);
    if (!emp || !emp.empresa.trocaSenhaObrigatoria) return problema(404, 'CONVITE_INVALIDO');
    return HttpResponse.json<ConviteValidacao>({
      cnpj: emp.empresa.cnpj,
      razaoSocial: emp.empresa.razaoSocial,
      expiraEm: new Date(Date.now() + 6 * 24 * 3_600_000).toISOString(),
    });
  }),

  http.post('*/api/portal/auth/login', async ({ request }) => {
    await delay();
    const corpo = (await request.json().catch(() => ({}))) as Partial<LoginInput>;
    const cnpj = normalizar(corpo.cnpj ?? '');
    const senha = corpo.senha ?? '';
    const errors: Record<string, string[]> = {};
    if (cnpj.length !== 14) errors.cnpj = ['Informe o CNPJ.'];
    if (!senha) errors.senha = ['Informe a senha.'];
    if (Object.keys(errors).length) return problema(400, 'VALIDACAO', { errors });

    const emp = banco.empresas.find((e) => e.empresa.cnpj === cnpj);
    if (!emp) return problema(401, 'CREDENCIAIS_INVALIDAS');

    if (emp.bloqueadoAte && new Date(emp.bloqueadoAte).getTime() > Date.now()) {
      return problema(423, 'ACESSO_BLOQUEADO', { bloqueadoAte: emp.bloqueadoAte });
    }

    if (emp.senha !== senha) {
      emp.tentativasFalhas += 1;
      if (emp.tentativasFalhas >= MAX_TENTATIVAS) {
        emp.tentativasFalhas = 0;
        emp.bloqueadoAte = new Date(Date.now() + QUINZE_MINUTOS).toISOString();
      }
      return problema(401, 'CREDENCIAIS_INVALIDAS');
    }

    if (!emp.ativa) return problema(403, 'EMPRESA_INATIVA');
    if (emp.conviteExpirado) return problema(401, 'CONVITE_EXPIRADO');

    emp.tentativasFalhas = 0;
    emp.bloqueadoAte = null;
    return HttpResponse.json<SessaoPortal>(sessao(emp));
  }),

  http.post('*/api/portal/auth/trocar-senha', async ({ request }) => {
    await delay();
    const auth = autenticar(request, false);
    if ('resposta' in auth) return auth.resposta;
    const emp = auth.empresa;

    const corpo = (await request.json().catch(() => ({}))) as Partial<TrocaSenhaInput>;
    const senhaAtual = corpo.senhaAtual ?? '';
    const novaSenha = corpo.novaSenha ?? '';
    if (!senhaAtual) {
      return problema(400, 'VALIDACAO', { errors: { senhaAtual: ['Informe a senha atual.'] } });
    }
    if (!senhaForte(novaSenha)) return problema(400, 'SENHA_FRACA');
    if (senhaAtual !== emp.senha) return problema(400, 'SENHA_ATUAL_INCORRETA');
    if (novaSenha === senhaAtual) {
      return problema(400, 'VALIDACAO', {
        errors: { novaSenha: ['A nova senha precisa ser diferente da atual.'] },
      });
    }

    emp.senha = novaSenha;
    emp.empresa.trocaSenhaObrigatoria = false;
    emp.versao += 1;
    for (const [token, id] of banco.convites)
      if (id === emp.empresa.id) banco.convites.delete(token);
    return HttpResponse.json<SessaoPortal>(sessao(emp));
  }),

  http.get('*/api/portal/me', async ({ request }) => {
    await delay();
    const auth = autenticar(request, false);
    if ('resposta' in auth) return auth.resposta;
    return HttpResponse.json<EmpresaPortal>({ ...auth.empresa.empresa });
  }),
];
