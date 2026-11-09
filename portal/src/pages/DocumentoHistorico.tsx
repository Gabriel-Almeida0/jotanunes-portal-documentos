import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api, ErroApi } from '../api/client';
import { MENSAGENS } from '../api/mensagens';
import type { DocumentoSituacaoPortal, EnvioPortal, ObraPortal, PeriodoPortal } from '../api/tipos';
import { Alerta } from '../components/Alerta';
import { BotaoBaixar } from '../components/BotaoBaixar';
import { Botao } from '../components/Botao';
import { Carregando } from '../components/Carregando';
import { ContextoObra } from '../components/ContextoObra';
import { EnvioArquivo } from '../components/EnvioArquivo';
import { IconeSetaEsquerda } from '../components/icons';
import { Selo } from '../components/Selo';
import { TituloPagina } from '../components/TituloPagina';
import {
  caminhoLista,
  caminhoPeriodos,
  listarDocumentos,
  listarHistorico,
  listarPeriodos,
} from '../utils/contexto';
import { formatarDataHora, formatarTamanho } from '../utils/datas';
import { ehPeriodico } from '../utils/periodos';
import './DocumentoHistorico.css';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string; naoEncontrado: boolean }
  | {
      tipo: 'pronto';
      documento: DocumentoSituacaoPortal | null;
      envios: EnvioPortal[];
      obra: ObraPortal | null;
      /** Período filtrado (`?periodo=`), quando o documento é periódico. */
      periodo: PeriodoPortal | null;
    };

/**
 * Histórico de envios de um documento (mais recente primeiro), no contexto certo: geral
 * (`/documentos/:tipo`) ou da obra (`/obras/:obraId/documentos/:tipo`). Nunca mostra quem analisou.
 * Documento periódico: `?periodo=AAAA-MM-DD` mostra só aquele período; o envio fica na página de
 * períodos.
 */
export function DocumentoHistorico() {
  const { tipoDocumentoId = '', obraId: obraIdParam } = useParams();
  const obraId = obraIdParam ?? null;
  const [busca] = useSearchParams();
  const periodoInicio = busca.get('periodo');
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [mensagem, setMensagem] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setEstado({ tipo: 'carregando' });
    try {
      const [documentos, envios, obras, periodos] = await Promise.all([
        listarDocumentos(obraId),
        listarHistorico(obraId, tipoDocumentoId, periodoInicio),
        obraId ? api.listarObras() : Promise.resolve([]),
        periodoInicio ? listarPeriodos(obraId, tipoDocumentoId) : Promise.resolve([]),
      ]);
      setEstado({
        tipo: 'pronto',
        documento: documentos.find((d) => d.tipoDocumento.id === tipoDocumentoId) ?? null,
        envios: [...envios].sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm)),
        obra: obras.find((o) => o.id === obraId) ?? null,
        periodo: periodos.find((p) => p.inicio === periodoInicio) ?? null,
      });
    } catch (erro) {
      if (
        erro instanceof ErroApi &&
        (erro.code === 'NAO_AUTENTICADO' || erro.code === 'TROCA_SENHA_OBRIGATORIA')
      ) {
        return;
      }
      setEstado({
        tipo: 'erro',
        mensagem: erro instanceof ErroApi ? erro.title : MENSAGENS.ERRO_INTERNO,
        naoEncontrado: erro instanceof ErroApi && erro.code === 'NAO_ENCONTRADO',
      });
    }
  }, [obraId, tipoDocumentoId, periodoInicio]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const nome = estado.tipo === 'pronto' ? estado.documento?.tipoDocumento.nome : undefined;
  const obra = estado.tipo === 'pronto' ? estado.obra : null;
  const periodo = estado.tipo === 'pronto' ? estado.periodo : null;
  const periodico =
    estado.tipo === 'pronto' && estado.documento ? ehPeriodico(estado.documento) : false;

  useEffect(() => {
    const titulo = [nome ?? 'Histórico de envios', periodo?.rotulo, obra?.nome]
      .filter(Boolean)
      .join(' · ');
    document.title = `${titulo} · Portal de documentos Jotanunes`;
  }, [nome, periodo?.rotulo, obra?.nome]);

  return (
    <div className="jn-container jn-pagina jn-historico-pagina">
      <Link
        to={periodico ? caminhoPeriodos(obraId, tipoDocumentoId) : caminhoLista(obraId)}
        className="jn-voltar"
      >
        <IconeSetaEsquerda tamanho={16} />
        {periodico
          ? 'Voltar para os períodos'
          : obraId
            ? obra
              ? `Voltar para a obra ${obra.nome}`
              : 'Voltar para a obra'
            : 'Voltar para meus documentos'}
      </Link>

      {obra && <ContextoObra obra={obra} />}

      {estado.tipo === 'carregando' && <Carregando texto="Carregando o histórico…" />}

      {estado.tipo === 'erro' && (
        <div className="jn-pagina__erro">
          <TituloPagina>Histórico de envios</TituloPagina>
          <Alerta tipo="erro" titulo={estado.mensagem} />
          {!estado.naoEncontrado && (
            <Botao variante="secundario" onClick={() => void carregar()}>
              Tentar de novo
            </Botao>
          )}
        </div>
      )}

      {estado.tipo === 'pronto' && (
        <>
          <TituloPagina
            subtitulo={
              estado.documento?.tipoDocumento.instrucoes ?? 'Histórico de envios deste documento.'
            }
          >
            {nome ?? 'Histórico de envios'}
          </TituloPagina>

          {periodo && <p className="jn-historico__periodo">Período: {periodo.rotulo}</p>}

          {(periodo ?? estado.documento) && (
            <div className="jn-historico__situacao">
              <span>Situação atual:</span>
              {periodo ? (
                <Selo situacao={periodo.situacao} atrasado={periodo.atrasado} />
              ) : (
                estado.documento && (
                  <Selo situacao={estado.documento.situacao} atrasado={estado.documento.atrasado} />
                )
              )}
            </div>
          )}

          <div aria-live="polite">{mensagem && <Alerta tipo="sucesso" titulo={mensagem} />}</div>

          {/* Periódico: o envio é feito por período, na página de períodos. */}
          {estado.documento?.podeEnviar && !periodico && (
            <EnvioArquivo
              tipoDocumento={estado.documento.tipoDocumento}
              obraId={obraId}
              rotulo={
                estado.documento.situacao === 'REJEITADO'
                  ? 'Enviar novo arquivo'
                  : 'Enviar documento'
              }
              aoEnviar={() => {
                setMensagem(
                  obra
                    ? `Recebemos o arquivo da obra ${obra.nome}. Agora é com a Jotanunes.`
                    : 'Recebemos o arquivo. Agora é com a Jotanunes.',
                );
                void carregar();
              }}
              aoDesatualizar={() => void carregar()}
            />
          )}

          <section aria-labelledby="titulo-envios" className="jn-historico">
            <h2 id="titulo-envios" className="jn-historico__titulo">
              Envios ({estado.envios.length})
            </h2>
            {estado.envios.length === 0 ? (
              <p className="jn-historico__vazio">
                Você ainda não enviou nenhum arquivo para este documento.
              </p>
            ) : (
              <ol className="jn-historico__lista">
                {estado.envios.map((envio, i) => (
                  <li
                    key={envio.id}
                    className={`jn-historico__item jn-historico__item--${envio.status.toLowerCase()}`}
                  >
                    <div className="jn-historico__cabeca">
                      <Selo situacao={envio.status} />
                      {i === 0 && <span className="jn-historico__atual">Envio mais recente</span>}
                    </div>
                    {envio.periodo && !periodo && (
                      <span className="jn-historico__periodo-envio">
                        Período: {envio.periodo.rotulo}
                      </span>
                    )}
                    {envio.enviadoComAtraso && (
                      <span className="jn-periodo__marca-atraso">Enviado com atraso</span>
                    )}
                    <BotaoBaixar envio={envio} />
                    <dl className="jn-historico__dados">
                      <div>
                        <dt>Enviado em</dt>
                        <dd>{formatarDataHora(envio.enviadoEm)}</dd>
                      </div>
                      <div>
                        <dt>Tamanho</dt>
                        <dd>{formatarTamanho(envio.tamanhoBytes)}</dd>
                      </div>
                      {envio.analisadoEm && (
                        <div>
                          <dt>Analisado em</dt>
                          <dd>{formatarDataHora(envio.analisadoEm)}</dd>
                        </div>
                      )}
                    </dl>
                    {envio.motivoRejeicao && (
                      <p className="jn-historico__motivo">
                        <strong>Motivo:</strong> {envio.motivoRejeicao}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
