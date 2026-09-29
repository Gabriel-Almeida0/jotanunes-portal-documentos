import { useState } from 'react';
import { Link } from 'react-router-dom';
import { mensagemDeErro } from '../../api/client';
import { api } from '../../api/fluig';
import type { DocumentoSituacao, Envio, TipoDocumentoRef } from '../../api/tipos';
import { useConsulta } from '../../api/useConsulta';
import { Alerta } from '../../components/Alerta';
import { Botao, BotaoLink } from '../../components/Botao';
import { Carregando, EstadoErro, EstadoVazio } from '../../components/Estados';
import { IconeAbrir, IconeSeta } from '../../components/icons';
import { Modal } from '../../components/Modal';
import { SeloSituacao } from '../../components/Selo';
import { Tabela } from '../../components/Tabela';
import { formatarDataHora } from '../../utils/datas';
import { formatarTamanho } from '../../utils/formatos';

/** Seção "Documentos" do detalhe da empresa: situação por tipo e histórico (US4, FR-046). */
export function SecaoDocumentos({ empresaId }: { empresaId: string }) {
  const consulta = useConsulta((sinal) => api.listarDocumentosEmpresa(empresaId, sinal), [empresaId]);
  const [historico, setHistorico] = useState<TipoDocumentoRef | null>(null);

  const documentos = consulta.dados ?? [];

  return (
    <section className="jn-secao" aria-labelledby="jn-documentos-titulo">
      <div className="jn-secao__cabecalho">
        <div>
          <h2 className="jn-secao__titulo" id="jn-documentos-titulo">
            Documentos
          </h2>
          <p className="jn-secao__descricao">Situação de cada documento exigido (todos os tipos ativos).</p>
        </div>
      </div>

      {consulta.carregando && !consulta.dados ? (
        <Carregando texto="Carregando documentos…" />
      ) : consulta.erro ? (
        <EstadoErro erro={consulta.erro} onTentarDeNovo={consulta.recarregar} />
      ) : documentos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum documento exigido no momento."
          texto="Não há tipos de documento ativos."
          acao={<BotaoLink variante="secundario" to="/tipos-documento">Ver tipos de documento</BotaoLink>}
        />
      ) : (
        <Tabela rotulo="Documentos da empresa">
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
              <LinhaDocumento key={d.tipoDocumento.id} documento={d} onHistorico={() => setHistorico(d.tipoDocumento)} />
            ))}
          </tbody>
        </Tabela>
      )}

      {historico ? (
        <ModalHistorico empresaId={empresaId} tipo={historico} onFechar={() => setHistorico(null)} />
      ) : null}
    </section>
  );
}

function LinhaDocumento({ documento, onHistorico }: { documento: DocumentoSituacao; onHistorico: () => void }) {
  const envio = documento.envioAtual ?? null;
  const qtd = documento.quantidadeEnvios ?? 0;
  return (
    <tr>
      <td>
        <span className="jn-tabela__principal">{documento.tipoDocumento.nome}</span>
        <span className="jn-tabela__sub">{qtd === 0 ? 'Nenhum envio' : qtd === 1 ? '1 envio' : `${qtd} envios`}</span>
      </td>
      <td>
        <SeloSituacao situacao={documento.situacao} />
      </td>
      <td>
        {envio ? (
          <>
            <span className="jn-documentos__arquivo">{envio.nomeArquivo}</span>
            <span className="jn-tabela__sub">Enviado em {formatarDataHora(envio.enviadoEm)}</span>
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
            <Link className="jn-link-acao" to={`/analise/${envio.id}`} aria-label={`Analisar ${documento.tipoDocumento.nome}`}>
              Analisar <IconeSeta tamanho={16} />
            </Link>
          ) : null}
          <Botao
            variante="fantasma"
            tamanho="pequeno"
            disabled={qtd === 0}
            onClick={onHistorico}
            aria-label={`Histórico de ${documento.tipoDocumento.nome}`}
          >
            Histórico
          </Botao>
        </span>
      </td>
    </tr>
  );
}

function ModalHistorico({ empresaId, tipo, onFechar }: { empresaId: string; tipo: TipoDocumentoRef; onFechar: () => void }) {
  const consulta = useConsulta(
    (sinal) => api.listarHistoricoEnvios(empresaId, tipo.id, sinal),
    [empresaId, tipo.id],
  );
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);

  async function abrir(envio: Envio) {
    setErroArquivo(null);
    try {
      await api.abrirArquivoEnvio(envio.id);
    } catch (e) {
      setErroArquivo(mensagemDeErro(e));
    }
  }

  return (
    <Modal aberto titulo={`Histórico: ${tipo.nome}`} onFechar={onFechar} largura="larga">
      <p className="jn-texto-secundario">Do envio mais recente para o mais antigo.</p>
      {erroArquivo ? <Alerta tom="erro">{erroArquivo}</Alerta> : null}
      {consulta.carregando && !consulta.dados ? (
        <Carregando texto="Carregando histórico…" />
      ) : consulta.erro ? (
        <EstadoErro erro={consulta.erro} onTentarDeNovo={consulta.recarregar} />
      ) : (consulta.dados ?? []).length === 0 ? (
        <p className="jn-texto-secundario">Nenhum envio para este documento.</p>
      ) : (
        <ol className="jn-historico" aria-label="Envios">
          {(consulta.dados ?? []).map((envio) => (
            <li key={envio.id} className="jn-historico__item">
              <div className="jn-historico__topo">
                <SeloSituacao situacao={envio.status} />
                <span className="jn-meta">Enviado em {formatarDataHora(envio.enviadoEm)}</span>
              </div>
              <p className="jn-historico__arquivo">
                {envio.nomeArquivo}{' '}
                <span className="jn-texto-secundario">({formatarTamanho(envio.tamanhoBytes)})</span>
              </p>
              {envio.analisadoEm ? (
                <p className="jn-historico__analise">
                  {envio.status === 'APROVADO' ? 'Aprovado' : 'Rejeitado'} por{' '}
                  <strong>{envio.analisadoPor?.nome ?? '—'}</strong> em {formatarDataHora(envio.analisadoEm)}
                </p>
              ) : (
                <p className="jn-historico__analise jn-texto-secundario">Aguardando análise.</p>
              )}
              {envio.motivoRejeicao ? <p className="jn-historico__motivo">Motivo: {envio.motivoRejeicao}</p> : null}
              <div>
                <Botao variante="fantasma" tamanho="pequeno" icone={<IconeAbrir tamanho={16} />} onClick={() => abrir(envio)}>
                  Abrir arquivo
                </Botao>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
