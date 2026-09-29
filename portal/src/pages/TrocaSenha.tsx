import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ErroApi } from '../api/client';
import { MENSAGENS } from '../api/mensagens';
import { useSessao } from '../auth/contexto';
import { Alerta } from '../components/Alerta';
import { Botao } from '../components/Botao';
import { Campo } from '../components/Campo';
import { IconeCadeado, IconeVisto } from '../components/icons';
import { regrasSenha, senhaForte } from '../utils/senha';
import './TrocaSenha.css';

interface Erros {
  senhaAtual?: string;
  novaSenha?: string;
  confirmacao?: string;
}

export function TrocaSenha() {
  const { atualizar, empresa, deixarRecado } = useSessao();
  const navigate = useNavigate();
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

  useEffect(() => {
    document.title = 'Crie sua senha · Portal de documentos Jotanunes';
  }, []);

  const regras = regrasSenha(novaSenha, senhaAtual);

  function validar(): Erros {
    const e: Erros = {};
    if (!senhaAtual) e.senhaAtual = 'Informe a senha que chegou no convite.';
    if (!novaSenha) e.novaSenha = 'Crie a nova senha.';
    else if (novaSenha.length > 128) e.novaSenha = 'Use no máximo 128 caracteres.';
    else if (!senhaForte(novaSenha)) e.novaSenha = MENSAGENS.SENHA_FRACA;
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
      deixarRecado('Senha criada. Agora é só enviar os documentos.');
      atualizar(sessao);
      navigate('/documentos', { replace: true });
    } catch (erro) {
      setEnviando(false);
      if (!(erro instanceof ErroApi)) return setErroGeral(MENSAGENS.ERRO_INTERNO);
      let novos: Erros = {};
      if (erro.code === 'SENHA_ATUAL_INCORRETA') novos = { senhaAtual: erro.title };
      else if (erro.code === 'SENHA_FRACA') novos = { novaSenha: erro.title };
      else if (erro.code === 'VALIDACAO') {
        novos = {
          senhaAtual: erro.erroDoCampo('senhaAtual'),
          novaSenha: erro.erroDoCampo('novaSenha'),
        };
        if (!novos.senhaAtual && !novos.novaSenha) setErroGeral(erro.title);
      } else if (erro.code !== 'NAO_AUTENTICADO') {
        setErroGeral(erro.title);
      }
      setErros(novos);
      focarPrimeiro(novos);
    }
  }

  return (
    <div className="jn-container jn-troca">
      <section className="jn-troca__painel" aria-labelledby="titulo-troca">
        <span className="jn-troca__icone" aria-hidden="true">
          <IconeCadeado tamanho={28} />
        </span>
        <span className="jn-troca__barra" aria-hidden="true" />
        <h1 id="titulo-troca">Crie uma nova senha para continuar.</h1>
        <p className="jn-troca__intro">
          {empresa ? (
            <>
              Primeiro acesso de <strong>{empresa.razaoSocial}</strong>.{' '}
            </>
          ) : null}
          A senha do convite vale só para este primeiro acesso. Depois, use a senha que você criar
          agora.
        </p>

        <form className="jn-troca__campos" onSubmit={aoEnviar} noValidate>
          <Campo
            ref={refs.senhaAtual}
            rotulo="Senha atual"
            ajuda="É a senha que chegou no e-mail do convite."
            senha
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            erro={erros.senhaAtual}
            autoComplete="current-password"
            maxLength={128}
            required
          />
          <Campo
            ref={refs.novaSenha}
            rotulo="Nova senha"
            senha
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            erro={erros.novaSenha}
            autoComplete="new-password"
            maxLength={128}
            required
            ajudaAbaixo={
              <ul className="jn-troca__regras" aria-label="A nova senha precisa ter">
                {regras.map((r) => (
                  <li key={r.id} className={r.ok ? 'jn-troca__regra--ok' : undefined}>
                    <span className="jn-troca__marca" aria-hidden="true">
                      {r.ok ? <IconeVisto tamanho={14} /> : null}
                    </span>
                    {r.texto}
                    <span className="jn-visually-hidden">{r.ok ? ' (ok)' : ' (falta)'}</span>
                  </li>
                ))}
              </ul>
            }
          />
          <Campo
            ref={refs.confirmacao}
            rotulo="Confirme a nova senha"
            senha
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            erro={erros.confirmacao}
            autoComplete="new-password"
            maxLength={128}
            required
          />

          {erroGeral && <Alerta tipo="erro" titulo={erroGeral} />}

          <Botao
            type="submit"
            variante="pill"
            bloco
            carregando={enviando}
            textoCarregando="Salvando…"
          >
            Salvar e continuar
          </Botao>
        </form>
      </section>
    </div>
  );
}
