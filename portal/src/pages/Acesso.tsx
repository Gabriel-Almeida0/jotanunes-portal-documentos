import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ErroApi } from '../api/client';
import { MENSAGENS } from '../api/mensagens';
import { useSessao } from '../auth/contexto';
import { Alerta } from '../components/Alerta';
import { Botao } from '../components/Botao';
import { Campo } from '../components/Campo';
import { cnpjValido, formatarCnpj, mascararCnpj, normalizarCnpj } from '../utils/cnpj';
import { formatarHora } from '../utils/datas';
import './Acesso.css';

type EstadoConvite =
  | { tipo: 'sem-convite' }
  | { tipo: 'conferindo' }
  | { tipo: 'valido'; razaoSocial: string }
  | { tipo: 'invalido'; mensagem: string };

interface ErrosCampos {
  cnpj?: string;
  senha?: string;
}

function mensagemDeErroLogin(erro: ErroApi): string {
  if (erro.code === 'ACESSO_BLOQUEADO' && erro.bloqueadoAte) {
    return `Muitas tentativas. Por segurança, o acesso ficou bloqueado. Tente de novo às ${formatarHora(erro.bloqueadoAte)}.`;
  }
  return erro.title;
}

export function Acesso() {
  const { sessao, trocaSenhaObrigatoria, entrar, aviso, limparAviso } = useSessao();
  const navigate = useNavigate();
  const local = useLocation();
  const [parametros] = useSearchParams();
  // O token do convite é segredo: lido uma única vez da URL e guardado só em memória.
  const [tokenConvite] = useState(() => parametros.get('convite'));

  const [cnpj, setCnpj] = useState('');
  const [senha, setSenha] = useState('');
  const [errosCampos, setErrosCampos] = useState<ErrosCampos>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [convite, setConvite] = useState<EstadoConvite>(
    tokenConvite ? { tipo: 'conferindo' } : { tipo: 'sem-convite' },
  );

  const refCnpj = useRef<HTMLInputElement>(null);
  const refSenha = useRef<HTMLInputElement>(null);

  // Antes de qualquer outra coisa (inclusive a chamada à API, que é o efeito seguinte), tira o `convite` da
  // URL: assim o token não fica no histórico, em favoritos nem vai no `Referer`. `navigate(..., { replace: true })`
  // chama `history.replaceState` na hora (BrowserRouter) e mantém o roteador sincronizado com a barra de endereço.
  // É `useEffect` (e não `useLayoutEffect`) porque o roteador só passa a ouvir o histórico no layout effect dele,
  // que roda depois dos filhos; efeitos comuns rodam depois de todos os layout effects.
  useEffect(() => {
    if (!parametros.has('convite')) return;
    const limpos = new URLSearchParams(parametros);
    limpos.delete('convite');
    const busca = limpos.toString();
    const destino = `${local.pathname}${busca ? `?${busca}` : ''}${local.hash}`;
    navigate(destino, { replace: true, state: local.state });
  }, [parametros, local.pathname, local.hash, local.state, navigate]);

  useEffect(() => {
    document.title = 'Acesso · Portal de documentos Jotanunes';
  }, []);

  // Link do convite: valida e pré-preenche o CNPJ.
  useEffect(() => {
    if (!tokenConvite) return;
    let ativo = true;
    api
      .validarConvite(tokenConvite)
      .then((dados) => {
        if (!ativo) return;
        setCnpj(formatarCnpj(dados.cnpj));
        setConvite({ tipo: 'valido', razaoSocial: dados.razaoSocial });
        refSenha.current?.focus();
      })
      .catch((erro: unknown) => {
        if (!ativo) return;
        const mensagem =
          erro instanceof ErroApi && erro.code !== 'CONVITE_INVALIDO'
            ? erro.title
            : MENSAGENS.CONVITE_INVALIDO;
        setConvite({ tipo: 'invalido', mensagem });
      });
    return () => {
      ativo = false;
    };
  }, [tokenConvite]);

  // Já conectado (sem link de convite): segue para onde precisa.
  if (sessao && !tokenConvite && !enviando) {
    return <Navigate to={trocaSenhaObrigatoria ? '/trocar-senha' : '/documentos'} replace />;
  }

  function validar(): ErrosCampos {
    const erros: ErrosCampos = {};
    if (!normalizarCnpj(cnpj)) erros.cnpj = 'Informe o CNPJ da empresa.';
    else if (!cnpjValido(cnpj))
      erros.cnpj = 'Confira o CNPJ. Ele tem 14 caracteres, no formato 00.000.000/0000-00.';
    if (!senha) erros.senha = 'Informe a senha.';
    return erros;
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    limparAviso();
    setErroGeral(null);
    const erros = validar();
    setErrosCampos(erros);
    if (erros.cnpj) return refCnpj.current?.focus();
    if (erros.senha) return refSenha.current?.focus();

    setEnviando(true);
    try {
      const nova = await api.login({ cnpj: normalizarCnpj(cnpj), senha });
      entrar(nova);
      const de = (local.state as { de?: string } | null)?.de;
      const destino = nova.empresa.trocaSenhaObrigatoria
        ? '/trocar-senha'
        : de && de.startsWith('/documentos')
          ? de
          : '/documentos';
      navigate(destino, { replace: true });
    } catch (erro) {
      setEnviando(false);
      if (erro instanceof ErroApi) {
        if (erro.code === 'VALIDACAO') {
          setErrosCampos({ cnpj: erro.erroDoCampo('cnpj'), senha: erro.erroDoCampo('senha') });
        }
        setErroGeral(mensagemDeErroLogin(erro));
        if (erro.code === 'CREDENCIAIS_INVALIDAS') {
          setSenha('');
          refSenha.current?.focus();
        }
      } else {
        setErroGeral(MENSAGENS.ERRO_INTERNO);
      }
    }
  }

  return (
    <div className="jn-container jn-acesso">
      <div className="jn-acesso__painel">
        <section className="jn-acesso__formulario" aria-labelledby="titulo-acesso">
          <span className="jn-acesso__barra" aria-hidden="true" />
          <h1 id="titulo-acesso">Acesse o portal de documentos</h1>
          <p className="jn-acesso__intro">
            Entre com o CNPJ da sua empresa e a senha que a Jotanunes enviou por e-mail.
          </p>

          <div className="jn-acesso__mensagens">
            {aviso && <Alerta tipo="aviso" titulo={aviso} />}
            {convite.tipo === 'conferindo' && (
              <Alerta tipo="info" titulo="Conferindo o seu convite…" />
            )}
            {convite.tipo === 'valido' && (
              <Alerta tipo="info" titulo={`Olá, ${convite.razaoSocial}!`}>
                Use a senha que chegou no e-mail do convite. Depois você cria a sua.
              </Alerta>
            )}
            {convite.tipo === 'invalido' && (
              <Alerta tipo="erro" titulo={convite.mensagem}>
                Se você já criou sua senha, é só entrar. Se não, peça um novo convite à Jotanunes.
              </Alerta>
            )}
          </div>

          <form className="jn-acesso__campos" onSubmit={aoEnviar} noValidate>
            <Campo
              ref={refCnpj}
              rotulo="CNPJ"
              name="cnpj"
              value={cnpj}
              onChange={(e) => setCnpj(mascararCnpj(e.target.value))}
              erro={errosCampos.cnpj}
              placeholder="00.000.000/0000-00"
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={18}
              required
            />
            <Campo
              ref={refSenha}
              rotulo="Senha"
              name="senha"
              senha
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              erro={errosCampos.senha}
              autoComplete="current-password"
              maxLength={128}
              required
            />

            {erroGeral && <Alerta tipo="erro" titulo={erroGeral} />}

            <Botao
              type="submit"
              variante="pill"
              bloco
              carregando={enviando}
              textoCarregando="Entrando…"
            >
              Acessar
            </Botao>
          </form>

          <p className="jn-acesso__ajuda">
            Esqueceu a senha ou o convite venceu? Peça à Jotanunes um novo convite: ele chega no
            e-mail da empresa com uma senha nova.
          </p>
        </section>

        <aside className="jn-acesso__lateral" aria-labelledby="titulo-como-funciona">
          <h2 id="titulo-como-funciona">Como funciona</h2>
          <ol className="jn-acesso__passos">
            <li>
              <span className="jn-acesso__numero" aria-hidden="true">
                1
              </span>
              <div>
                <strong>Entre com o convite</strong>
                <p>Use o CNPJ e a senha que chegaram no e-mail.</p>
              </div>
            </li>
            <li>
              <span className="jn-acesso__numero" aria-hidden="true">
                2
              </span>
              <div>
                <strong>Crie a sua senha</strong>
                <p>No primeiro acesso, você cria uma senha só sua.</p>
              </div>
            </li>
            <li>
              <span className="jn-acesso__numero" aria-hidden="true">
                3
              </span>
              <div>
                <strong>Envie os documentos</strong>
                <p>Anexe os arquivos em PDF, JPG ou PNG e acompanhe a análise por aqui.</p>
              </div>
            </li>
          </ol>
        </aside>
      </div>
    </div>
  );
}
