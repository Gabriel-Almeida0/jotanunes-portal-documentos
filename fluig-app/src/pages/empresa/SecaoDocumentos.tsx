import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useEhAdmin } from '../../auth/contexto';
import { api } from '../../api/fluig';
import type { DocumentoSituacao, Empresa, ObraNaEmpresa, ObraRef, TipoDocumentoRef } from '../../api/tipos';
import { useConsulta } from '../../api/useConsulta';
import { Botao, BotaoLink } from '../../components/Botao';
import { Carregando, EstadoErro, EstadoVazio } from '../../components/Estados';
import { HistoricoEnvios } from '../../components/HistoricoEnvios';
import { IconePin, IconeSeta } from '../../components/icons';
import { Modal } from '../../components/Modal';
import { ModalPeriodos } from '../../components/ModalPeriodos';
import { ResumoDocumentos } from '../../components/ResumoDocumentos';
import { SeloAtivo, SeloComAtraso, SeloSituacaoPeriodo } from '../../components/Selo';
import { Tabela } from '../../components/Tabela';
import { formatarDataHora } from '../../utils/datas';
import { textoPeriodicidade, textoResumoPeriodos } from '../../utils/periodicidade';

/** Documento aberto no histórico: geral (`obra` null) ou de uma obra. */
interface AlvoHistorico {
  tipo: TipoDocumentoRef;
  obra: ObraRef | null;
}

/**
 * Documentos do detalhe da empresa (002, US4/FR-241): "Documentos gerais" (valem em todas as obras),
 * um bloco por obra com vínculo ativo e, recolhidas, as obras com vínculo encerrado (só histórico).
 * `?obra=<id>` na URL leva direto ao bloco daquela obra.
 */
export function SecaoDocumentos({ empresa }: { empresa: Empresa }) {
  const [historico, setHistorico] = useState<AlvoHistorico | null>(null);
  const [periodos, setPeriodos] = useState<AlvoHistorico | null>(null);
  const [params] = useSearchParams();
  const obraDestacada = params.get('obra');
  const ativas = empresa.obras.filter((o) => o.vinculoAtivo);
  const encerradas = empresa.obras.filter((o) => !o.vinculoAtivo);

  return (
    <>
      <DocumentosGerais empresaId={empresa.id} onHistorico={setHistorico} onPeriodos={setPeriodos} />

      <section className="jn-secao" aria-labelledby="jn-documentos-obras-titulo">
        <div className="jn-secao__cabecalho">
          <div>
            <h2 className="jn-secao__titulo" id="jn-documentos-obras-titulo">
              Documentos por obra
            </h2>
            <p className="jn-secao__descricao">
              Cada obra pede os seus documentos; a situação de uma obra não muda a das outras.
            </p>
          </div>
        </div>
        {ativas.length === 0 ? (
          <p className="jn-texto-secundario">
            Esta empresa não está em nenhuma obra no momento. Vincule pela página da <Link to="/obras">obra</Link>.
          </p>
        ) : (
          <div className="jn-pilha">
            {ativas.map((o) => (
              <BlocoObra
                key={o.id}
                empresaId={empresa.id}
                obra={o}
                destacada={o.id === obraDestacada}
                onHistorico={setHistorico}
                onPeriodos={setPeriodos}
              />
            ))}
          </div>
        )}

        {encerradas.length > 0 ? (
          <ObrasEncerradas
            empresaId={empresa.id}
            obras={encerradas}
            obraDestacada={obraDestacada}
            onHistorico={setHistorico}
            onPeriodos={setPeriodos}
          />
        ) : null}
      </section>

      {historico ? (
        <ModalHistorico empresaId={empresa.id} alvo={historico} onFechar={() => setHistorico(null)} />
      ) : null}

      {periodos ? (
        <ModalPeriodos
          empresaId={empresa.id}
          tipo={periodos.tipo}
          obra={periodos.obra}
          onFechar={() => setPeriodos(null)}
        />
      ) : null}
    </>
  );
}

function DocumentosGerais({
  empresaId,
  onHistorico,
  onPeriodos,
}: {
  empresaId: string;
  onHistorico: (alvo: AlvoHistorico) => void;
  onPeriodos: (alvo: AlvoHistorico) => void;
}) {
  const consulta = useConsulta((sinal) => api.listarDocumentosEmpresa(empresaId, sinal), [empresaId]);
  const documentos = consulta.dados ?? [];

  return (
    <section className="jn-secao" aria-labelledby="jn-documentos-titulo">
      <div className="jn-secao__cabecalho">
        <div>
          <h2 className="jn-secao__titulo" id="jn-documentos-titulo">
            Documentos gerais
          </h2>
          <p className="jn-secao__descricao">
            Documentos da empresa como um todo (tipos gerais ativos): valem em todas as obras. Os periódicos pedem um
            arquivo por período.
          </p>
        </div>
      </div>

      {consulta.carregando && !consulta.dados ? (
        <Carregando texto="Carregando documentos…" />
      ) : consulta.erro ? (
        <EstadoErro erro={consulta.erro} onTentarDeNovo={consulta.recarregar} />
      ) : documentos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum documento geral exigido no momento."
          texto="Não há tipos de documento gerais ativos."
          acao={<BotaoLink variante="secundario" to="/tipos-documento">Ver tipos de documento</BotaoLink>}
        />
      ) : (
        <TabelaDocumentos
          rotulo="Documentos gerais da empresa"
          documentos={documentos}
          onHistorico={(tipo) => onHistorico({ tipo, obra: null })}
          onPeriodos={(tipo) => onPeriodos({ tipo, obra: null })}
        />
      )}

      <TiposDesativados empresaId={empresaId} onHistorico={(tipo) => onHistorico({ tipo, obra: null })} />
    </section>
  );
}

function TabelaDocumentos({
  rotulo,
  documentos,
  onHistorico,
  onPeriodos,
}: {
  rotulo: string;
  documentos: DocumentoSituacao[];
  onHistorico: (tipo: TipoDocumentoRef) => void;
  onPeriodos: (tipo: TipoDocumentoRef) => void;
}) {
  return (
    <Tabela rotulo={rotulo}>
      <thead>
        <tr>
          <th scope="col">Documento</th>
          <th scope="col">Situação</th>
          <th scope="col">Envio atual</th>
          <th scope="col">Análise</th>
          <th scope="col" className="jn-tabela__acoes">
            <span className="jn-sr-only">Ações</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {documentos.map((d) => (
          <LinhaDocumento
            key={d.tipoDocumento.id}
            documento={d}
            onHistorico={() => onHistorico(d.tipoDocumento)}
            onPeriodos={() => onPeriodos(d.tipoDocumento)}
          />
        ))}
      </tbody>
    </Tabela>
  );
}

/** Bloco de uma obra: progresso + situação de cada documento da obra (rota da empresa na obra). */
function BlocoObra({
  empresaId,
  obra,
  destacada,
  onHistorico,
  onPeriodos,
}: {
  empresaId: string;
  obra: ObraNaEmpresa;
  destacada: boolean;
  onHistorico: (alvo: AlvoHistorico) => void;
  onPeriodos: (alvo: AlvoHistorico) => void;
}) {
  const consulta = useConsulta(
    (sinal) => api.listarDocumentosEmpresaObra(obra.id, empresaId, sinal),
    [obra.id, empresaId],
  );
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (destacada) ref.current?.scrollIntoView?.({ block: 'start' });
  }, [destacada]);

  const idTitulo = `jn-obra-${obra.id}`;
  const documentos = consulta.dados ?? [];
  const obraRef: ObraRef = { id: obra.id, nome: obra.nome, cidade: obra.cidade, uf: obra.uf };

  return (
    <section
      ref={ref}
      className={`jn-painel-bloco jn-bloco-obra ${destacada ? 'jn-bloco-obra--destacada' : ''}`.trim()}
      aria-labelledby={idTitulo}
    >
      <div className="jn-bloco-obra__cabecalho">
        <div>
          <h3 className="jn-bloco-obra__titulo" id={idTitulo}>
            <Link to={`/obras/${obra.id}`}>{obra.nome}</Link>
          </h3>
          <span className="jn-meta jn-local">
            <IconePin tamanho={16} /> {obra.cidade}/{obra.uf}
          </span>
          {!obra.obraAtiva ? (
            <span className="jn-meta">
              {' '}
              <SeloAtivo ativo={false} feminino /> Obra inativa: os documentos dela não são exigidos agora.
            </span>
          ) : null}
          {!obra.vinculoAtivo ? <span className="jn-meta"> · Vínculo encerrado: só histórico.</span> : null}
        </div>
        <ResumoDocumentos contagem={obra.documentos} rotulo="Documentos desta obra" />
      </div>

      {consulta.carregando && !consulta.dados ? (
        <Carregando texto="Carregando documentos da obra…" />
      ) : consulta.erro ? (
        <EstadoErro erro={consulta.erro} onTentarDeNovo={consulta.recarregar} />
      ) : documentos.length === 0 ? (
        <p className="jn-texto-secundario">Esta obra não exige documentos por obra no momento.</p>
      ) : (
        <TabelaDocumentos
          rotulo={`Documentos da obra ${obra.nome}`}
          documentos={documentos}
          onHistorico={(tipo) => onHistorico({ tipo, obra: obraRef })}
          onPeriodos={(tipo) => onPeriodos({ tipo, obra: obraRef })}
        />
      )}
    </section>
  );
}

/** Obras com vínculo encerrado, recolhidas (FR-241); os blocos só carregam ao abrir. */
function ObrasEncerradas({
  empresaId,
  obras,
  obraDestacada,
  onHistorico,
  onPeriodos,
}: {
  empresaId: string;
  obras: ObraNaEmpresa[];
  obraDestacada: string | null;
  onHistorico: (alvo: AlvoHistorico) => void;
  onPeriodos: (alvo: AlvoHistorico) => void;
}) {
  const [aberto, setAberto] = useState(() => obras.some((o) => o.id === obraDestacada));

  return (
    <details
      className="jn-recolhivel jn-obras-encerradas"
      open={aberto}
      onToggle={(e) => setAberto((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary>
        Obras encerradas ({obras.length})
        <span className="jn-recolhivel__resumo">— vínculo encerrado, só histórico</span>
      </summary>
      {aberto ? (
        <div className="jn-recolhivel__corpo jn-pilha">
          {obras.map((o) => (
            <BlocoObra
              key={o.id}
              empresaId={empresaId}
              obra={o}
              destacada={o.id === obraDestacada}
              onHistorico={onHistorico}
              onPeriodos={onPeriodos}
            />
          ))}
        </div>
      ) : null}
    </details>
  );
}

/**
 * Tipos desativados não aparecem na tabela acima (que só lista os exigidos hoje), mas os envios
 * feitos enquanto estavam ativos continuam no histórico (Edge Case da spec, FR-046). O contrato não
 * informa quais tipos inativos têm envio desta empresa, então listamos todos os inativos e o
 * histórico é buscado só quando o analista abre — sem uma chamada por tipo ao carregar a página.
 */
function TiposDesativados({
  empresaId,
  onHistorico,
}: {
  empresaId: string;
  onHistorico: (tipo: TipoDocumentoRef) => void;
}) {
  const consulta = useConsulta(
    (sinal) => api.listarTipos({ ativo: false, abrangencia: 'GERAL' }, sinal),
    [empresaId],
  );
  const tipos = consulta.dados ?? [];

  if (consulta.carregando && !consulta.dados) return null;
  if (!consulta.erro && tipos.length === 0) return null;

  return (
    <section className="jn-documentos__desativados" aria-labelledby="jn-tipos-desativados-titulo">
      <h3 className="jn-documentos__desativados-titulo" id="jn-tipos-desativados-titulo">
        Tipos desativados
      </h3>
      <p className="jn-secao__descricao">
        Não são mais exigidos, mas os envios feitos antes da desativação continuam guardados.
      </p>
      {consulta.erro ? (
        <EstadoErro erro={consulta.erro} onTentarDeNovo={consulta.recarregar} />
      ) : (
        <ul className="jn-lista-simples" aria-label="Tipos desativados">
          {tipos.map((t) => (
            <li key={t.id}>
              <span className="jn-documentos__desativado-nome">
                {t.nome} <SeloAtivo ativo={false} />
              </span>
              <Botao
                variante="fantasma"
                tamanho="pequeno"
                onClick={() =>
                  onHistorico({
                    id: t.id,
                    nome: t.nome,
                    instrucoes: t.instrucoes,
                    abrangencia: t.abrangencia,
                    periodicidade: t.periodicidade,
                  })
                }
                aria-label={`Ver histórico de ${t.nome}`}
              >
                Ver histórico
              </Botao>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LinhaDocumento({
  documento,
  onHistorico,
  onPeriodos,
}: {
  documento: DocumentoSituacao;
  onHistorico: () => void;
  onPeriodos: () => void;
}) {
  const envio = documento.envioAtual ?? null;
  const qtd = documento.quantidadeEnvios ?? 0;
  const acao = useEhAdmin() ? 'Analisar' : 'Ver';
  const nome = documento.tipoDocumento.nome;
  /** 003: documento periódico — situação resumida, contagem por período e a lista de períodos. */
  const resumo = documento.periodos ?? null;
  return (
    <tr>
      <td>
        <span className="jn-tabela__principal">{nome}</span>
        {resumo ? (
          <span className="jn-tabela__sub">{textoPeriodicidade(documento.tipoDocumento.periodicidade)}</span>
        ) : null}
        <span className="jn-tabela__sub">{qtd === 0 ? 'Nenhum envio' : qtd === 1 ? '1 envio' : `${qtd} envios`}</span>
      </td>
      <td>
        <SeloSituacaoPeriodo situacao={documento.situacao} atrasado={Boolean(documento.atrasado)} />
        {resumo ? (
          <span className="jn-tabela__sub jn-documentos__resumo-periodos">
            {textoResumoPeriodos(resumo)} ·{' '}
            <button type="button" className="jn-link-acao" onClick={onPeriodos} aria-label={`Ver períodos de ${nome}`}>
              Ver períodos
            </button>
          </span>
        ) : null}
      </td>
      <td>
        {envio ? (
          <>
            {envio.periodo ? <span className="jn-tabela__sub">Período: {envio.periodo.rotulo}</span> : null}
            <span className="jn-documentos__arquivo">{envio.nomeArquivo}</span>
            <span className="jn-tabela__sub">Enviado em {formatarDataHora(envio.enviadoEm)}</span>
            {envio.enviadoComAtraso ? <SeloComAtraso /> : null}
          </>
        ) : (
          <span className="jn-texto-secundario">—</span>
        )}
      </td>
      <td>
        {envio?.analisadoEm ? (
          <>
            <span>
              {envio.analisadoPor?.nome ?? '—'}
            </span>
            <span className="jn-tabela__sub">{formatarDataHora(envio.analisadoEm)}</span>
            {envio.motivoRejeicao ? (
              <span className="jn-documentos__motivo">Motivo: {envio.motivoRejeicao}</span>
            ) : null}
          </>
        ) : envio ? (
          <span className="jn-texto-secundario">Aguardando análise</span>
        ) : (
          <span className="jn-texto-secundario">—</span>
        )}
      </td>
      <td className="jn-tabela__acoes">
        <span className="jn-acoes-linha">
          {documento.situacao === 'EM_ANALISE' && envio ? (
            <Link
              className="jn-link-acao"
              to={`/analise/${envio.id}`}
              aria-label={`${acao} ${nome}${envio.periodo ? ` de ${envio.periodo.rotulo}` : ''}`}
            >
              {acao} <IconeSeta tamanho={16} />
            </Link>
          ) : null}
          <Botao
            variante="fantasma"
            tamanho="pequeno"
            disabled={qtd === 0}
            onClick={onHistorico}
            aria-label={`Histórico de ${nome}`}
          >
            Histórico
          </Botao>
        </span>
      </td>
    </tr>
  );
}

function ModalHistorico({
  empresaId,
  alvo,
  onFechar,
}: {
  empresaId: string;
  alvo: AlvoHistorico;
  onFechar: () => void;
}) {
  const { tipo, obra } = alvo;
  const obraId = obra?.id ?? null;
  const consulta = useConsulta(
    (sinal) =>
      obraId
        ? api.listarHistoricoEnviosEmpresaObra(obraId, empresaId, tipo.id, sinal)
        : api.listarHistoricoEnvios(empresaId, tipo.id, sinal),
    [empresaId, tipo.id, obraId],
  );

  return (
    <Modal aberto titulo={`Histórico: ${tipo.nome}`} onFechar={onFechar} largura="larga">
      <p className="jn-texto-secundario">
        {obra ? `Obra: ${obra.nome} (${obra.cidade}/${obra.uf}).` : 'Documento geral da empresa.'} Do envio mais
        recente para o mais antigo.
      </p>
      {consulta.carregando && !consulta.dados ? (
        <Carregando texto="Carregando histórico…" />
      ) : consulta.erro ? (
        <EstadoErro erro={consulta.erro} onTentarDeNovo={consulta.recarregar} />
      ) : (consulta.dados ?? []).length === 0 ? (
        <p className="jn-texto-secundario">Nenhum envio para este documento.</p>
      ) : (
        <HistoricoEnvios envios={consulta.dados ?? []} />
      )}
    </Modal>
  );
}
