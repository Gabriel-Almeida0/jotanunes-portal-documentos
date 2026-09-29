import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ErroApi, mensagemDeErro } from '../api/client';
import { MENSAGENS_ERRO } from '../api/mensagens';
import { api } from '../api/fluig';
import { useSessao, useUsuarioFluig } from '../auth/contexto';
import { Alerta } from '../components/Alerta';
import { Botao } from '../components/Botao';
import { Campo } from '../components/Campo';
import { IconeCadeado, IconeCheck } from '../components/icons';
import { TituloPagina } from '../components/TituloPagina';
import { TAMANHO_MAXIMO_SENHA, regrasSenha, senhaForte } from '../utils/senha';
import './TrocaSenha.css';

export const RECADO_SENHA_ALTERADA = 'Senha alterada.';

type CampoSenha = 'senhaAtual' | 'novaSenha' | 'confirmacao';
type Erros = Partial<Record<CampoSenha, string>>;

/**
 * Troca de senha do login próprio (FR-102, FR-103, FR-105).
 * - `obrigatorio`: senha provisória — a única tela até a troca (sem menu), com "Sair".
 * - `voluntario`: rota `/trocar-senha` do menu, com "Cancelar"; sessão do Fluig volta ao painel.
 */
export function TrocaSenha({ modo = 'voluntario' }: { modo?: 'obrigatorio' | 'voluntario' }) {
  return modo === 'obrigatorio' ? <TrocaObrigatoria /> : <TrocaVoluntaria />;
}

function TrocaObrigatoria() {
  const usuario = useUsuarioFluig();
  const { sair } = useSessao();
  const [saindo, setSaindo] = useState(false);
  const primeiroNome = usuario.nome.split(' ')[0];

  return (
    <div className="jn-app jn-app--centro jn-troca">
      <main className="jn-troca__painel" aria-labelledby="jn-troca-titulo">
        <span className="jn-troca__icone" aria-hidden="true">
          <IconeCadeado tamanho={28} />
        </span>
        <span className="jn-troca__barra" aria-hidden="true" />
        <h1 id="jn-troca-titulo" className="jn-troca__titulo">
          Crie uma nova senha para continuar.
        </h1>
        <p className="jn-troca__intro">
          Olá, {primeiroNome}! A senha provisória que chegou por e-mail vale só para este primeiro acesso. Depois,
          use a senha que você criar agora.
        </p>
        <FormularioTrocaSenha
          rotuloSalvar="Salvar e continuar"
          ajudaSenhaAtual="É a senha provisória que chegou no seu e-mail."
          acaoSecundaria={
            <Botao
              variante="fantasma"
              carregando={saindo}
              textoCarregando="Saindo…"
              onClick={() => {
                setSaindo(true);
                void sair();
              }}
            >
              Sair
            </Botao>
          }
        />
      </main>
    </div>
  );
}

function TrocaVoluntaria() {
  const usuario = useUsuarioFluig();
  const navigate = useNavigate();
  if (usuario.origem !== 'LOGIN_LOCAL') return <Navigate to="/" replace />;
  return (
    <>
      <TituloPagina
        titulo="Trocar senha"
        descricao="Informe a senha atual e crie a nova. As outras sessões abertas com o seu login deixam de valer."
      />
      <div className="jn-painel-bloco jn-painel-bloco--assinatura jn-troca__bloco">
        <FormularioTrocaSenha
          rotuloSalvar="Salvar nova senha"
          aoConcluir={() => navigate('/', { replace: true })}
          acaoSecundaria={
            <Botao variante="secundario" onClick={() => navigate('/')}>
              Cancelar
            </Botao>
          }
        />
      </div>
    </>
  );
}

function FormularioTrocaSenha({
  rotuloSalvar,
  ajudaSenhaAtual,
  acaoSecundaria,
  aoConcluir,
}: {
  rotuloSalvar: string;
  ajudaSenhaAtual?: string;
  acaoSecundaria: ReactNode;
  aoConcluir?: () => void;
}) {
  const { atualizarToken } = useSessao();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const refs = {
    senhaAtual: useRef<HTMLInputElement>(null),
    novaSenha: useRef<HTMLInputElement>(null),
    confirmacao: useRef<HTMLInputElement>(null),
  };
  const montado = useRef(true);
  useEffect(
    () => () => {
      montado.current = false;
    },
    [],
  );

  const regras = regrasSenha(novaSenha, senhaAtual);

  function validar(): Erros {
    const e: Erros = {};
    if (!senhaAtual) e.senhaAtual = 'Informe a senha atual.';
    if (!novaSenha) e.novaSenha = 'Crie a nova senha.';
    else if (novaSenha.length > TAMANHO_MAXIMO_SENHA) e.novaSenha = 'Use no máximo 128 caracteres.';
    else if (!senhaForte(novaSenha)) e.novaSenha = MENSAGENS_ERRO.SENHA_FRACA;
    else if (novaSenha === senhaAtual) e.novaSenha = 'A nova senha precisa ser diferente da atual.';
    if (!e.novaSenha && confirmacao !== novaSenha) {
      e.confirmacao = confirmacao ? 'As senhas não são iguais.' : 'Repita a nova senha.';
    }
    return e;
  }

  function focarPrimeiro(e: Erros) {
    const primeiro = (['senhaAtual', 'novaSenha', 'confirmacao'] as const).find((c) => e[c]);
    if (primeiro) refs[primeiro].current?.focus();
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    setErroGeral(null);
    const e = validar();
    setErros(e);
    if (Object.keys(e).length) return focarPrimeiro(e);

    setEnviando(true);
    try {
      const sessao = await api.trocarSenha({ senhaAtual, novaSenha });
      atualizarToken(sessao, RECADO_SENHA_ALTERADA);
      aoConcluir?.();
    } catch (erro) {
      if (!montado.current) return;
      setEnviando(false);
      let novos: Erros = {};
      if (erro instanceof ErroApi && erro.code === 'SENHA_ATUAL_INCORRETA') novos = { senhaAtual: erro.title };
      else if (erro instanceof ErroApi && erro.code === 'SENHA_FRACA') novos = { novaSenha: erro.title };
      else if (erro instanceof ErroApi && erro.code === 'VALIDACAO') {
        novos = { senhaAtual: erro.erroDoCampo('senhaAtual'), novaSenha: erro.erroDoCampo('novaSenha') };
        if (!novos.senhaAtual && !novos.novaSenha) setErroGeral(erro.title);
      } else if (!(erro instanceof ErroApi && erro.code === 'NAO_AUTENTICADO')) {
        setErroGeral(mensagemDeErro(erro));
      }
      setErros(novos);
      focarPrimeiro(novos);
    }
  }

  return (
    <form className="jn-troca__campos" onSubmit={aoEnviar} noValidate>
      <Campo
        ref={refs.senhaAtual}
        rotulo="Senha atual"
        type="password"
        ajuda={ajudaSenhaAtual}
        value={senhaAtual}
        onChange={(e) => setSenhaAtual(e.target.value)}
        erro={erros.senhaAtual}
        autoComplete="current-password"
        maxLength={TAMANHO_MAXIMO_SENHA}
        required
      />
      <Campo
        ref={refs.novaSenha}
        rotulo="Nova senha"
        type="password"
        value={novaSenha}
        onChange={(e) => setNovaSenha(e.target.value)}
        erro={erros.novaSenha}
        autoComplete="new-password"
        maxLength={TAMANHO_MAXIMO_SENHA}
        required
      />
      <div className="jn-troca__regras">
        <p className="jn-troca__regras-titulo" id="jn-troca-regras">
          A nova senha precisa ter:
        </p>
        <ul aria-labelledby="jn-troca-regras">
          {regras.map((r) => (
            <li key={r.id} className={r.ok ? 'jn-troca__regra--ok' : undefined}>
              <span className="jn-troca__marca" aria-hidden="true">
                {r.ok ? <IconeCheck tamanho={14} /> : null}
              </span>
              <span>{r.texto}</span>
              <span className="jn-sr-only">{r.ok ? ' (atendida)' : ' (falta)'}</span>
            </li>
          ))}
        </ul>
      </div>
      <Campo
        ref={refs.confirmacao}
        rotulo="Confirme a nova senha"
        type="password"
        value={confirmacao}
        onChange={(e) => setConfirmacao(e.target.value)}
        erro={erros.confirmacao}
        autoComplete="new-password"
        maxLength={TAMANHO_MAXIMO_SENHA}
        required
      />

      {erroGeral ? <Alerta tom="erro">{erroGeral}</Alerta> : null}

      <div className="jn-troca__acoes">
        {acaoSecundaria}
        <Botao type="submit" carregando={enviando} textoCarregando="Salvando…">
          {rotuloSalvar}
        </Botao>
      </div>
    </form>
  );
}
