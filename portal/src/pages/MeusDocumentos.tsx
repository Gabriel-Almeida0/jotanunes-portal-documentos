import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ErroApi } from '../api/client';
import { MENSAGENS } from '../api/mensagens';
import type { DocumentoSituacaoPortal, EnvioPortal, SituacaoDocumento } from '../api/tipos';
import { useSessao } from '../auth/contexto';
import { Alerta } from '../components/Alerta';
import { Botao } from '../components/Botao';
import { Carregando } from '../components/Carregando';
import { CartaoDocumento } from '../components/CartaoDocumento';
import { TituloPagina } from '../components/TituloPagina';
import './MeusDocumentos.css';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'pronto'; documentos: DocumentoSituacaoPortal[] };

/** Rejeitados primeiro (precisam de ação), depois pendentes, em análise e aprovados. */
const ORDEM: Record<SituacaoDocumento, number> = {
  REJEITADO: 0,
  PENDENTE_ENVIO: 1,
  EM_ANALISE: 2,
  APROVADO: 3,
};

function ordenar(documentos: DocumentoSituacaoPortal[]): DocumentoSituacaoPortal[] {
  return [...documentos].sort(
    (a, b) =>
      ORDEM[a.situacao] - ORDEM[b.situacao] ||
      a.tipoDocumento.nome.localeCompare(b.tipoDocumento.nome, 'pt-BR'),
  );
}

const RESUMO: { situacao: SituacaoDocumento; singular: string; plural: string }[] = [
  { situacao: 'REJEITADO', singular: 'rejeitado', plural: 'rejeitados' },
  { situacao: 'PENDENTE_ENVIO', singular: 'pendente de envio', plural: 'pendentes de envio' },
  { situacao: 'EM_ANALISE', singular: 'em análise', plural: 'em análise' },
  { situacao: 'APROVADO', singular: 'aprovado', plural: 'aprovados' },
];

export function MeusDocumentos() {
  const { pegarRecado } = useSessao();
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [mensagem, setMensagem] = useState<string | null>(null);
  const refTitulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = 'Meus documentos · Portal de documentos Jotanunes';
    const recado = pegarRecado();
    if (recado) setMensagem(recado);
  }, [pegarRecado]);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setEstado({ tipo: 'carregando' });
    try {
      const documentos = await api.listarDocumentos();
      setEstado({ tipo: 'pronto', documentos: ordenar(documentos) });
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
      });
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function aoEnviar(documento: DocumentoSituacaoPortal, envio: EnvioPortal) {
    setEstado((atual) =>
      atual.tipo !== 'pronto'
        ? atual
        : {
            tipo: 'pronto',
            documentos: atual.documentos.map((d) =>
              d.tipoDocumento.id === documento.tipoDocumento.id
                ? { ...d, situacao: 'EM_ANALISE', envioAtual: envio, podeEnviar: false }
                : d,
            ),
          },
    );
    setMensagem(
      `Recebemos o arquivo de ${documento.tipoDocumento.nome}. Agora é com a Jotanunes: a situação muda para "Aprovado" ou "Rejeitado" depois da análise.`,
    );
    refTitulo.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  const documentos = estado.tipo === 'pronto' ? estado.documentos : [];
  const contagem = (s: SituacaoDocumento) => documentos.filter((d) => d.situacao === s).length;
  const precisamDeAcao = contagem('REJEITADO') + contagem('PENDENTE_ENVIO');

  return (
    <div className="jn-container jn-pagina">
      <div ref={refTitulo}>
        <TituloPagina subtitulo="Envie os documentos que a Jotanunes pede e acompanhe a análise por aqui.">
          Meus documentos
        </TituloPagina>
      </div>

      <div className="jn-pagina__avisos" aria-live="polite">
        {mensagem && (
          <Alerta tipo="sucesso" titulo={mensagem}>
            <button type="button" className="jn-fechar" onClick={() => setMensagem(null)}>
              Fechar aviso
            </button>
          </Alerta>
        )}
      </div>

      {estado.tipo === 'carregando' && <Carregando texto="Carregando seus documentos…" />}

      {estado.tipo === 'erro' && (
        <div className="jn-pagina__erro">
          <Alerta tipo="erro" titulo="Não conseguimos carregar seus documentos.">
            {estado.mensagem}
          </Alerta>
          <Botao variante="secundario" onClick={() => void carregar()}>
            Tentar de novo
          </Botao>
        </div>
      )}

      {estado.tipo === 'pronto' && (
        <>
          {documentos.length > 0 && (
            <section aria-label="Resumo dos documentos" className="jn-resumo">
              <ul>
                {RESUMO.map(({ situacao, singular, plural }) => {
                  const n = contagem(situacao);
                  return (
                    <li
                      key={situacao}
                      className={`jn-resumo__item jn-resumo__item--${situacao.toLowerCase()}`}
                    >
                      <span className="jn-resumo__numero">{n}</span>
                      <span className="jn-resumo__rotulo">{n === 1 ? singular : plural}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {precisamDeAcao === 0 ? (
            <div className="jn-vazio" role="status">
              <p className="jn-vazio__titulo">Nenhum documento pendente. Tudo certo por aqui.</p>
              {documentos.length > 0 && (
                <p className="jn-vazio__texto">
                  Se a Jotanunes pedir um documento novo ou recusar algum arquivo, ele aparece aqui.
                </p>
              )}
            </div>
          ) : (
            <p className="jn-pagina__orientacao">
              {precisamDeAcao === 1 ? 'Falta 1 documento.' : `Faltam ${precisamDeAcao} documentos.`}{' '}
              Envie cada um em PDF, JPG ou PNG, com até 10 MB.
            </p>
          )}

          {documentos.length > 0 && (
            <ul className="jn-grade" aria-label="Documentos exigidos">
              {documentos.map((documento) => (
                <li key={documento.tipoDocumento.id}>
                  <CartaoDocumento
                    documento={documento}
                    aoEnviar={(envio) => aoEnviar(documento, envio)}
                    aoDesatualizar={() => void carregar(true)}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
