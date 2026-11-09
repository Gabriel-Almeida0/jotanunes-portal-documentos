import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErroApi, mensagemDeErro, salvarComo } from '../api/client';
import { api } from '../api/fluig';
import type { EnvioFila, FormatoArquivo } from '../api/tipos';
import { useConsulta } from '../api/useConsulta';
import { useEhAdmin } from '../auth/contexto';
import { Alerta } from '../components/Alerta';
import { AvisoSomenteAdmin } from '../components/AvisoSomenteAdmin';
import { Botao } from '../components/Botao';
import { CampoArea } from '../components/Campo';
import { Carregando, EstadoErro } from '../components/Estados';
import { HistoricoEnvios } from '../components/HistoricoEnvios';
import { IconeAbrir, IconeCheck, IconeDocumento, IconeDownload, IconeFechar } from '../components/icons';
import { Modal, ModalConfirmacao } from '../components/Modal';
import { SeloComAtraso, SeloSituacao } from '../components/Selo';
import { TituloPagina } from '../components/TituloPagina';
import type { Aviso } from '../hooks/useAviso';
import { formatarCnpj } from '../utils/cnpj';
import { formatarDataHora, tempoDecorrido } from '../utils/datas';
import { formatarTamanho } from '../utils/formatos';
import { formatarDiaIso, prazoDoPeriodo } from '../utils/periodicidade';
import './EnvioAnalise.css';

const FORMATOS: Record<FormatoArquivo, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
};

const MOTIVO_MIN = 5;
const MOTIVO_MAX = 500;

export function EnvioAnalise() {
  const { envioId = '' } = useParams();
  const navigate = useNavigate();
  const consulta = useConsulta((sinal) => api.obterEnvio(envioId, sinal), [envioId]);
  const [aprovando, setAprovando] = useState(false);
  const [rejeitando, setRejeitando] = useState(false);
  const [decidindo, setDecidindo] = useState(false);
  const [erroDecisao, setErroDecisao] = useState<string | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<'abrir' | 'baixar' | null>(null);
  const ehAdmin = useEhAdmin();

  if (consulta.carregando && !consulta.dados) return <Carregando texto="Carregando envio…" />;
  if (consulta.erro || !consulta.dados) {
    const naoEncontrado = consulta.erro instanceof ErroApi && consulta.erro.status === 404;
    return (
      <>
        <TituloPagina titulo="Envio" voltar={{ para: '/analise', rotulo: 'Fila de análise' }} />
        <EstadoErro erro={consulta.erro} onTentarDeNovo={naoEncontrado ? undefined : consulta.recarregar} />
      </>
    );
  }

  const envio = consulta.dados;
  const emAnalise = envio.status === 'EM_ANALISE';
  /** Só o administrador decide; o comum vê os dados e o arquivo (FR-081, FR-082). */
  const podeDecidir = emAnalise && ehAdmin;

  async function decidir(acao: () => Promise<unknown>, aviso: Aviso) {
    setDecidindo(true);
    setErroDecisao(null);
    try {
      await acao();
      navigate('/analise', { state: { aviso } });
    } catch (erro) {
      setAprovando(false);
      setRejeitando(false);
      if (erro instanceof ErroApi && erro.code === 'ENVIO_JA_ANALISADO') {
        consulta.recarregar();
      }
      if (erro instanceof ErroApi && erro.code === 'VALIDACAO') {
        setRejeitando(true);
        throw erro;
      }
      setErroDecisao(mensagemDeErro(erro));
    } finally {
      setDecidindo(false);
    }
  }

  const periodo = envio.periodo ?? null;
  /** O contrato não traz o prazo no envio: fim do período + prazo atual do tipo (003). */
  const prazo = periodo ? prazoDoPeriodo(periodo, envio.tipoDocumento.periodicidade) : null;
  const descricao = `${envio.tipoDocumento.nome}${periodo ? ` (${periodo.rotulo})` : ''} de ${
    envio.empresa.razaoSocial
  }${envio.obra ? ` na obra ${envio.obra.nome}` : ''}`;

  async function abrir() {
    setErroArquivo(null);
    setBaixando('abrir');
    try {
      await api.abrirArquivoEnvio(envio.id);
    } catch (e) {
      setErroArquivo(mensagemDeErro(e));
    } finally {
      setBaixando(null);
    }
  }

  async function baixar() {
    setErroArquivo(null);
    setBaixando('baixar');
    try {
      const arquivo = await api.baixarArquivoEnvio(envio.id);
      salvarComo(arquivo);
      window.setTimeout(arquivo.liberar, 10_000);
    } catch (e) {
      setErroArquivo(mensagemDeErro(e));
    } finally {
      setBaixando(null);
    }
  }

  return (
    <>
      <TituloPagina titulo={envio.tipoDocumento.nome} voltar={{ para: '/analise', rotulo: 'Fila de análise' }}>
        <SeloSituacao situacao={envio.status} />
        {envio.enviadoComAtraso ? <SeloComAtraso /> : null}
        {periodo ? (
          <span className="jn-meta jn-envio__periodo">
            Período: <strong>{periodo.rotulo}</strong>
            {prazo ? ` · prazo ${formatarDiaIso(prazo)}` : ''}
          </span>
        ) : null}
        <span className="jn-meta">
          <Link to={`/empresas/${envio.empresa.id}`}>{envio.empresa.razaoSocial}</Link>
        </span>
        <span className="jn-meta jn-envio__contexto">
          {envio.obra ? (
            <Link to={`/obras/${envio.obra.id}`}>Obra: {envio.obra.nome}</Link>
          ) : (
            'Geral da empresa'
          )}
        </span>
        <span className="jn-meta">
          Enviado em {formatarDataHora(envio.enviadoEm)} ({tempoDecorrido(envio.enviadoEm)})
        </span>
      </TituloPagina>

      <AvisoSomenteAdmin />

      {erroDecisao ? (
        <div className="jn-avisos">
          <Alerta tom="erro" onFechar={() => setErroDecisao(null)}>
            {erroDecisao}
          </Alerta>
        </div>
      ) : null}

      <div className="jn-grade-detalhe">
        <section className="jn-painel-bloco jn-painel-bloco--assinatura" aria-labelledby="jn-envio-arquivo">
          <div className="jn-painel-bloco__cabecalho">
            <h2 className="jn-painel-bloco__titulo" id="jn-envio-arquivo">
              Arquivo enviado
            </h2>
          </div>
          <div className="jn-envio__arquivo">
            <span className="jn-envio__arquivo-icone" aria-hidden="true">
              <IconeDocumento tamanho={28} />
            </span>
            <div className="jn-envio__arquivo-dados">
              <p className="jn-envio__arquivo-nome">{envio.nomeArquivo}</p>
              <p className="jn-texto-secundario">
                {FORMATOS[envio.formato] ?? envio.formato} · {formatarTamanho(envio.tamanhoBytes)}
              </p>
            </div>
          </div>
          <div className="jn-envio__botoes-arquivo">
            <Botao
              variante="secundario"
              icone={<IconeAbrir tamanho={18} />}
              onClick={abrir}
              carregando={baixando === 'abrir'}
              textoCarregando="Abrindo…"
              disabled={Boolean(baixando)}
            >
              Abrir arquivo
            </Botao>
            <Botao
              variante="fantasma"
              icone={<IconeDownload tamanho={18} />}
              onClick={baixar}
              carregando={baixando === 'baixar'}
              textoCarregando="Baixando…"
              disabled={Boolean(baixando)}
            >
              Baixar
            </Botao>
          </div>
          {erroArquivo ? <Alerta tom="erro">{erroArquivo}</Alerta> : null}

          <h3 className="jn-envio__subtitulo">O que a empresa precisava enviar</h3>
          <p className="jn-envio__instrucoes">
            {envio.tipoDocumento.instrucoes || 'Este tipo de documento não tem instruções cadastradas.'}
          </p>
        </section>

        <div className="jn-pilha">
          <section className="jn-painel-bloco" aria-labelledby="jn-envio-decisao">
            <div className="jn-painel-bloco__cabecalho">
              <h2 className="jn-painel-bloco__titulo" id="jn-envio-decisao">
                {podeDecidir ? 'Sua decisão' : emAnalise ? 'Análise' : 'Resultado da análise'}
              </h2>
            </div>
            {podeDecidir ? (
              <>
                <p className="jn-texto-secundario">
                  Confira o arquivo antes de decidir. Ao rejeitar, a empresa recebe um e-mail com o motivo e pode
                  enviar um novo arquivo.
                </p>
                <div className="jn-envio__decisao">
                  <Botao icone={<IconeCheck tamanho={18} />} onClick={() => setAprovando(true)}>
                    Aprovar
                  </Botao>
                  <Botao variante="secundario" icone={<IconeFechar tamanho={18} />} onClick={() => setRejeitando(true)}>
                    Rejeitar
                  </Botao>
                </div>
              </>
            ) : emAnalise ? (
              <div className="jn-pilha">
                <div>
                  <SeloSituacao situacao={envio.status} />
                </div>
                <p className="jn-texto-secundario">Este documento aguarda a decisão de um administrador.</p>
              </div>
            ) : (
              <ResultadoAnalise envio={envio} />
            )}
          </section>

          <section className="jn-painel-bloco" aria-labelledby="jn-envio-empresa">
            <div className="jn-painel-bloco__cabecalho">
              <h2 className="jn-painel-bloco__titulo" id="jn-envio-empresa">
                Empresa
              </h2>
            </div>
            <dl className="jn-dados">
              <dt>Razão social</dt>
              <dd>
                <Link to={`/empresas/${envio.empresa.id}`}>{envio.empresa.razaoSocial}</Link>
              </dd>
              <dt>CNPJ</dt>
              <dd className="jn-mono">{formatarCnpj(envio.empresa.cnpj)}</dd>
              <dt>Obra</dt>
              <dd>
                {envio.obra ? (
                  <>
                    {envio.obra.nome}{' '}
                    <span className="jn-texto-secundario">
                      ({envio.obra.cidade}/{envio.obra.uf})
                    </span>
                  </>
                ) : (
                  'Geral da empresa (vale em todas as obras)'
                )}
              </dd>
              {periodo ? (
                <>
                  <dt>Período</dt>
                  <dd>
                    {periodo.rotulo}{' '}
                    <span className="jn-texto-secundario">
                      ({formatarDiaIso(periodo.inicio)} a {formatarDiaIso(periodo.fim)})
                    </span>
                  </dd>
                  <dt>Prazo do período</dt>
                  <dd>
                    {formatarDiaIso(prazo)}
                    {envio.enviadoComAtraso ? ' — enviado depois do prazo' : ' — enviado no prazo'}
                  </dd>
                </>
              ) : null}
            </dl>
          </section>
        </div>
      </div>

      <HistoricoDocumento envio={envio} />

      <ModalConfirmacao
        aberto={podeDecidir && aprovando}
        titulo="Aprovar documento?"
        mensagem={
          <p>
            <strong>{descricao}</strong>. A decisão fica registrada com o seu nome e não pode ser desfeita.
          </p>
        }
        rotuloConfirmar="Aprovar"
        carregando={decidindo}
        onConfirmar={() =>
          decidir(() => api.aprovarEnvio(envio.id), {
            tom: 'sucesso',
            situacao: 'APROVADO',
            texto: `${descricao}.`,
          }).catch(() => undefined)
        }
        onCancelar={() => setAprovando(false)}
      />

      {podeDecidir && rejeitando ? (
        <ModalRejeicao
          descricao={descricao}
          enviando={decidindo}
          onCancelar={() => setRejeitando(false)}
          onRejeitar={(motivo) =>
            decidir(() => api.rejeitarEnvio(envio.id, motivo), {
              tom: 'sucesso',
              situacao: 'REJEITADO',
              texto: `${descricao}. A empresa foi avisada por e-mail.`,
            })
          }
        />
      ) : null}
    </>
  );
}

/**
 * Histórico só deste documento, no contexto certo: geral da empresa ou da obra do envio (US3). Para
 * documento periódico, só os envios do período deste envio (003).
 */
function HistoricoDocumento({ envio }: { envio: EnvioFila }) {
  const obraId = envio.obra?.id ?? null;
  const periodo = envio.periodo ?? null;
  const periodoInicio = periodo?.inicio;
  const consulta = useConsulta(
    (sinal) =>
      obraId
        ? api.listarHistoricoEnviosEmpresaObra(obraId, envio.empresa.id, envio.tipoDocumento.id, sinal, periodoInicio)
        : api.listarHistoricoEnvios(envio.empresa.id, envio.tipoDocumento.id, sinal, periodoInicio),
    [obraId, envio.empresa.id, envio.tipoDocumento.id, envio.status, periodoInicio],
  );

  return (
    <section className="jn-secao jn-envio__historico" aria-labelledby="jn-envio-historico">
      <div className="jn-secao__cabecalho">
        <div>
          <h2 className="jn-secao__titulo" id="jn-envio-historico">
            {periodo ? `Histórico do período ${periodo.rotulo}` : 'Histórico deste documento'}
          </h2>
          <p className="jn-secao__descricao">
            {periodo
              ? `Envios de ${envio.empresa.razaoSocial} para ${envio.tipoDocumento.nome}${envio.obra ? ` na obra ${envio.obra.nome}` : ''} neste período, do mais recente para o mais antigo.`
              : envio.obra
              ? `Envios de ${envio.empresa.razaoSocial} para ${envio.tipoDocumento.nome} na obra ${envio.obra.nome}, do mais recente para o mais antigo.`
              : `Envios de ${envio.empresa.razaoSocial} para ${envio.tipoDocumento.nome} (geral da empresa), do mais recente para o mais antigo.`}
          </p>
        </div>
      </div>
      {consulta.carregando && !consulta.dados ? (
        <Carregando texto="Carregando histórico…" />
      ) : consulta.erro ? (
        <EstadoErro erro={consulta.erro} onTentarDeNovo={consulta.recarregar} />
      ) : (
        <HistoricoEnvios
          envios={consulta.dados ?? []}
          rotulo={periodo ? `Histórico do período ${periodo.rotulo}` : 'Histórico deste documento'}
          envioAtualId={envio.id}
        />
      )}
    </section>
  );
}

function ResultadoAnalise({ envio }: { envio: EnvioFila }) {
  return (
    <div className="jn-pilha">
      <SeloSituacao situacao={envio.status} />
      <dl className="jn-dados">
        <dt>{envio.status === 'APROVADO' ? 'Aprovado por' : 'Rejeitado por'}</dt>
        <dd>{envio.analisadoPor?.nome ?? '—'}</dd>
        <dt>Em</dt>
        <dd>{formatarDataHora(envio.analisadoEm)}</dd>
      </dl>
      {envio.motivoRejeicao ? (
        <p className="jn-envio__motivo">
          <strong>Motivo:</strong> {envio.motivoRejeicao}
        </p>
      ) : null}
    </div>
  );
}

function ModalRejeicao({
  descricao,
  enviando,
  onCancelar,
  onRejeitar,
}: {
  descricao: string;
  enviando: boolean;
  onCancelar: () => void;
  onRejeitar: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    const limpo = motivo.trim();
    if (limpo.length < MOTIVO_MIN || limpo.length > MOTIVO_MAX) {
      setErro(`Informe o motivo da rejeição (de ${MOTIVO_MIN} a ${MOTIVO_MAX} caracteres).`);
      return;
    }
    setErro(null);
    try {
      await onRejeitar(limpo);
    } catch (e) {
      if (e instanceof ErroApi) setErro(e.erroDoCampo('motivo') ?? e.title);
    }
  }

  return (
    <Modal
      aberto
      titulo="Rejeitar documento"
      onFechar={onCancelar}
      bloqueado={enviando}
      focoInicial="jn-motivo-rejeicao"
      rodape={
        <>
          <Botao variante="secundario" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Botao>
          <Botao variante="perigo" onClick={confirmar} carregando={enviando} textoCarregando="Rejeitando…">
            Rejeitar documento
          </Botao>
        </>
      }
    >
      <p>
        <strong>{descricao}</strong>
      </p>
      <CampoArea
        id="jn-motivo-rejeicao"
        rotulo="Motivo da rejeição"
        obrigatorio
        rows={5}
        maxLength={MOTIVO_MAX}
        value={motivo}
        onChange={(e) => {
          setMotivo(e.target.value);
          if (erro) setErro(null);
        }}
        erro={erro}
        ajuda="Explique o que precisa ser corrigido. A empresa vê este texto e recebe por e-mail."
        complemento={`${motivo.trim().length}/${MOTIVO_MAX}`}
        placeholder="Ex.: Documento ilegível, envie de novo em PDF."
      />
    </Modal>
  );
}
