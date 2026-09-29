import { useId, useState, type FormEvent } from 'react';
import { ErroApi, ehSemPermissao, mensagemDeErro } from '../api/client';
import { api } from '../api/fluig';
import type { UsuarioInterno } from '../api/tipos';
import { Alerta } from './Alerta';
import { Botao } from './Botao';
import { Campo } from './Campo';
import { Modal } from './Modal';

const FORMATO_LOGIN = /^[A-Za-z0-9._-]{3,100}$/;
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MENSAGEM_LOGIN_INVALIDO =
  'Use de 3 a 100 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.';
export const NOTA_PROPRIO_PAPEL = 'Você não pode tirar o seu próprio acesso de administrador.';

type Campos = 'nome' | 'email' | 'login';
type Erros = Partial<Record<Campos, string>>;

export interface FormularioUsuarioProps {
  /** `null` = cadastro de usuário novo. */
  usuario: UsuarioInterno | null;
  /** Linha do próprio usuário (sessão de login próprio): o perfil fica só leitura (FR-110). */
  proprio?: boolean;
  onFechar: () => void;
  onSalvo: (usuario: UsuarioInterno, novo: boolean) => void;
  onSemPermissao: (mensagem: string) => void;
}

/**
 * Cadastro/edição de usuário interno (US9). O login só é informado no cadastro (não muda depois).
 * Erros de negócio (e-mail que não saiu, último administrador, alteração própria) aparecem no
 * formulário mantendo os dados digitados.
 */
export function FormularioUsuario({ usuario, proprio = false, onFechar, onSalvo, onSemPermissao }: FormularioUsuarioProps) {
  const novo = usuario === null;
  const idAdmin = useId();
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');
  const [login, setLogin] = useState('');
  const [admin, setAdmin] = useState(usuario?.admin ?? false);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function validar(): Erros {
    const e: Erros = {};
    const nomeLimpo = nome.trim();
    if (nomeLimpo.length < 3 || nomeLimpo.length > 150) e.nome = 'Informe o nome (de 3 a 150 caracteres).';
    if (!FORMATO_EMAIL.test(email.trim()) || email.trim().length > 254) e.email = 'Informe um e-mail válido.';
    if (novo && !FORMATO_LOGIN.test(login.trim())) e.login = MENSAGEM_LOGIN_INVALIDO;
    return e;
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    const e = validar();
    setErros(e);
    setErroGeral(null);
    if (Object.keys(e).length) return;

    setSalvando(true);
    try {
      const dados = { nome: nome.trim(), email: email.trim() };
      const salvo = usuario
        ? await api.atualizarUsuario(usuario.id, { ...dados, admin: proprio ? usuario.admin : admin, ativo: usuario.ativo })
        : await api.criarUsuario({ ...dados, login: login.trim(), admin });
      onSalvo(salvo, novo);
    } catch (erro) {
      setSalvando(false);
      if (ehSemPermissao(erro)) return onSemPermissao(erro.title);
      if (erro instanceof ErroApi && erro.code === 'LOGIN_DUPLICADO') return setErros({ login: erro.title });
      if (erro instanceof ErroApi && erro.code === 'VALIDACAO') {
        setErros({ nome: erro.erroDoCampo('nome'), email: erro.erroDoCampo('email'), login: erro.erroDoCampo('login') });
      }
      setErroGeral(mensagemDeErro(erro));
    }
  }

  return (
    <Modal
      aberto
      titulo={novo ? 'Novo usuário' : 'Editar usuário'}
      onFechar={onFechar}
      bloqueado={salvando}
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao type="submit" form="jn-form-usuario" carregando={salvando} textoCarregando="Salvando…">
            {novo ? 'Cadastrar' : 'Salvar'}
          </Botao>
        </>
      }
    >
      <form id="jn-form-usuario" className="jn-pilha" onSubmit={salvar} noValidate>
        {erroGeral ? <Alerta tom="erro">{erroGeral}</Alerta> : null}
        {novo ? (
          <p className="jn-usuario-form__nota">
            A pessoa recebe no e-mail o login e uma senha provisória (vale 7 dias) e cria a própria senha no
            primeiro acesso.
          </p>
        ) : (
          <div className="jn-usuario-form__login">
            <span className="jn-usuario-form__rotulo">Login</span>
            <span className="jn-usuario-form__valor">{usuario.login}</span>
            <span className="jn-usuario-form__nota">O login não pode ser alterado.</span>
          </div>
        )}
        <Campo
          rotulo="Nome"
          obrigatorio
          maxLength={150}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          erro={erros.nome}
          autoComplete="off"
        />
        <Campo
          rotulo="E-mail"
          obrigatorio
          type="email"
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          erro={erros.email}
          autoComplete="off"
          ajuda={novo ? 'A senha provisória vai para este e-mail.' : undefined}
        />
        {novo ? (
          <Campo
            rotulo="Login"
            obrigatorio
            maxLength={100}
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            erro={erros.login}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            ajuda="Letras sem acento, números, ponto, hífen ou sublinhado. De preferência, o mesmo login do Fluig."
          />
        ) : null}
        <div className="jn-caixa">
          <input
            id={idAdmin}
            type="checkbox"
            className="jn-caixa__controle"
            checked={admin}
            disabled={proprio}
            onChange={(e) => setAdmin(e.target.checked)}
            aria-describedby={`${idAdmin}-ajuda`}
          />
          <label htmlFor={idAdmin} className="jn-caixa__rotulo">
            Administrador
          </label>
          <p id={`${idAdmin}-ajuda`} className="jn-caixa__ajuda">
            {proprio
              ? NOTA_PROPRIO_PAPEL
              : 'Pode cadastrar, alterar e analisar, e gerenciar os usuários. Sem marcar, o usuário é comum: consulta e envia convites.'}
          </p>
        </div>
      </form>
    </Modal>
  );
}
