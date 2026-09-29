import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ErroApi, mensagemDeErro } from '../api/client';
import { api } from '../api/fluig';
import logoJotanunes from '../assets/logo-jotanunes.png';
import { useSessao } from '../auth/contexto';
import { Alerta } from '../components/Alerta';
import { Botao } from '../components/Botao';
import { Campo } from '../components/Campo';
import { formatarHora } from '../utils/datas';
import './Login.css';

interface ErrosCampos {
  login?: string;
  senha?: string;
}

/** Mensagem por `code` (títulos do contrato); o bloqueio ganha o horário de liberação. */
function mensagemDoLogin(erro: unknown): string {
  if (erro instanceof ErroApi && erro.code === 'ACESSO_BLOQUEADO' && erro.bloqueadoAte) {
    return `Muitas tentativas. Por segurança, o acesso ficou bloqueado. Tente de novo às ${formatarHora(erro.bloqueadoAte)}.`;
  }
  return mensagemDeErro(erro);
}

/**
 * Tela de login próprio da área Jotanunes (US8, research R17): aparece sem token e com o login
 * próprio ligado. Não mostra nenhum dado; o logo fica dentro do painel de acesso (constituição V,
 * exceção da v1.2.0) e não há cabeçalho de marca fora dele.
 */
export function Login({ aviso = null }: { aviso?: string | null }) {
  const { entrar } = useSessao();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [erros, setErros] = useState<ErrosCampos>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const refLogin = useRef<HTMLInputElement>(null);
  const refSenha = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const anterior = document.title;
    document.title = 'Acesso · Documentação de terceirizadas';
    return () => {
      document.title = anterior;
    };
  }, []);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    setErroGeral(null);
    const novos: ErrosCampos = {};
    if (!login.trim()) novos.login = 'Informe o login.';
    if (!senha) novos.senha = 'Informe a senha.';
    setErros(novos);
    if (novos.login) return refLogin.current?.focus();
    if (novos.senha) return refSenha.current?.focus();

    setEnviando(true);
    try {
      const sessao = await api.login({ login: login.trim(), senha });
      entrar(sessao);
    } catch (erro) {
      setEnviando(false);
      setErroGeral(mensagemDoLogin(erro));
      if (erro instanceof ErroApi && erro.code === 'VALIDACAO') {
        setErros({ login: erro.erroDoCampo('login'), senha: erro.erroDoCampo('senha') });
      } else if (erro instanceof ErroApi && erro.code === 'LOGIN_INVALIDO') {
        setSenha('');
        refSenha.current?.focus();
      }
    }
  }

  return (
    <div className="jn-app jn-app--centro jn-login">
      <main className="jn-login__painel" aria-labelledby="jn-login-titulo">
        <img className="jn-login__logo" src={logoJotanunes} alt="Jotanunes Construtora" width={166} height={45} />
        <span className="jn-login__barra" aria-hidden="true" />
        <h1 id="jn-login-titulo" className="jn-login__titulo">
          Acesse a documentação de terceirizadas
        </h1>
        <p className="jn-login__intro">Entre com o login e a senha que você recebeu por e-mail.</p>

        {aviso ? <Alerta tom="aviso">{aviso}</Alerta> : null}

        <form className="jn-login__campos" onSubmit={aoEnviar} noValidate>
          <Campo
            ref={refLogin}
            rotulo="Login"
            name="login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            erro={erros.login}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={100}
            required
          />
          <Campo
            ref={refSenha}
            rotulo="Senha"
            name="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            erro={erros.senha}
            autoComplete="current-password"
            maxLength={128}
            required
          />

          {erroGeral ? <Alerta tom="erro">{erroGeral}</Alerta> : null}

          <Botao type="submit" className="jn-login__acessar" carregando={enviando} textoCarregando="Entrando…">
            Acessar
          </Botao>
        </form>

        <p className="jn-login__ajuda">Esqueceu a senha? Peça a um administrador do sistema para gerar uma nova.</p>
      </main>
    </div>
  );
}
