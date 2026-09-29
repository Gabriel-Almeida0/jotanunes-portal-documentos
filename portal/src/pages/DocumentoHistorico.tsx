import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ErroApi } from '../api/client';
import { MENSAGENS } from '../api/mensagens';
import type { DocumentoSituacaoPortal, EnvioPortal } from '../api/tipos';
import { Alerta } from '../components/Alerta';
import { BotaoBaixar } from '../components/BotaoBaixar';
import { Botao } from '../components/Botao';
import { Carregando } from '../components/Carregando';
import { EnvioArquivo } from '../components/EnvioArquivo';
import { IconeSetaEsquerda } from '../components/icons';
import { Selo } from '../components/Selo';
import { TituloPagina } from '../components/TituloPagina';
import { formatarDataHora, formatarTamanho } from '../utils/datas';
import './DocumentoHistorico.css';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string; naoEncontrado: boolean }
  | { tipo: 'pronto'; documento: DocumentoSituacaoPortal | null; envios: EnvioPortal[] };

/** Histórico de envios de um tipo (mais recente primeiro). Nunca mostra quem analisou. */
export function DocumentoHistorico() {
  const { tipoDocumentoId = '' } = useParams();
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [mensagem, setMensagem] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setEstado({ tipo: 'carregando' });
    try {
      const [documentos, envios] = await Promise.all([
        api.listarDocumentos(),
        api.listarHistorico(tipoDocumentoId),
      ]);
      setEstado({
        tipo: 'pronto',
        documento: documentos.find((d) => d.tipoDocumento.id === tipoDocumentoId) ?? null,
        envios: [...envios].sort((a, b) => b.enviadoEm.localeCompare(a.enviadoEm)),
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
  }, [tipoDocumentoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const nome = estado.tipo === 'pronto' ? estado.documento?.tipoDocumento.nome : undefined;

  useEffect(() => {
    document.title = `${nome ?? 'Histórico de envios'} · Portal de documentos Jotanunes`;
  }, [nome]);

  return (
    <div className="jn-container jn-pagina jn-historico-pagina">
      <Link to="/documentos" className="jn-voltar">
        <IconeSetaEsquerda tamanho={16} />
        Voltar para meus documentos
      </Link>

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

          {estado.documento && (
            <div className="jn-historico__situacao">
              <span>Situação atual:</span>
              <Selo situacao={estado.documento.situacao} />
            </div>
          )}

          <div aria-live="polite">{mensagem && <Alerta tipo="sucesso" titulo={mensagem} />}</div>

          {estado.documento?.podeEnviar && (
            <EnvioArquivo
              tipoDocumento={estado.documento.tipoDocumento}
              rotulo={
                estado.documento.situacao === 'REJEITADO'
                  ? 'Enviar novo arquivo'
                  : 'Enviar documento'
              }
              aoEnviar={() => {
                setMensagem('Recebemos o arquivo. Agora é com a Jotanunes.');
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
