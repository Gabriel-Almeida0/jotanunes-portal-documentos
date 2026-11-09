import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ErroApi } from '../api/client';
import { MENSAGENS } from '../api/mensagens';
import type {
  DocumentoSituacaoPortal,
  EnvioPortal,
  ObraPortal,
  SituacaoDocumento,
} from '../api/tipos';
import { Alerta } from '../components/Alerta';
import { Botao } from '../components/Botao';
import { Carregando } from '../components/Carregando';
import { CartaoDocumento } from '../components/CartaoDocumento';
import { ContextoObra } from '../components/ContextoObra';
import { IconeSetaEsquerda } from '../components/icons';
import { TituloPagina } from '../components/TituloPagina';
import { caminhoDocumento } from '../utils/contexto';
import './MeusDocumentos.css';
import './DocumentoHistorico.css';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'nao-encontrada' }
  | { tipo: 'pronto'; obra: ObraPortal; documentos: DocumentoSituacaoPortal[] };

const ORDEM: Record<SituacaoDocumento, number> = {
  REJEITADO: 0,
  PENDENTE_ENVIO: 1,
  EM_ANALISE: 2,
  APROVADO: 3,
};

function ordenar(documentos: DocumentoSituacaoPortal[]): DocumentoSituacaoPortal[] {
  return [...documentos].sort(
    (a, b) =>
      Number(b.atrasado) - Number(a.atrasado) ||
      ORDEM[a.situacao] - ORDEM[b.situacao] ||
      a.tipoDocumento.nome.localeCompare(b.tipoDocumento.nome, 'pt-BR'),
  );
}

/** Documentos exigidos da empresa numa obra (`/obras/:obraId`). */
export function DocumentosObra() {
  const { obraId = '' } = useParams();
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [mensagem, setMensagem] = useState<string | null>(null);
  const refTitulo = useRef<HTMLDivElement>(null);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setEstado({ tipo: 'carregando' });
      try {
        // Não há rota de detalhe da obra no portal: o nome vem da lista de obras da empresa.
        const [obras, documentos] = await Promise.all([
          api.listarObras(),
          api.listarDocumentosObra(obraId),
        ]);
        const obra = obras.find((o) => o.id === obraId);
        setEstado(
          obra
            ? { tipo: 'pronto', obra, documentos: ordenar(documentos) }
            : { tipo: 'nao-encontrada' },
        );
      } catch (erro) {
        if (
          erro instanceof ErroApi &&
          (erro.code === 'NAO_AUTENTICADO' || erro.code === 'TROCA_SENHA_OBRIGATORIA')
        ) {
          return;
        }
        if (erro instanceof ErroApi && erro.code === 'NAO_ENCONTRADO') {
          setEstado({ tipo: 'nao-encontrada' });
          return;
        }
        setEstado({
          tipo: 'erro',
          mensagem: erro instanceof ErroApi ? erro.title : MENSAGENS.ERRO_INTERNO,
        });
      }
    },
    [obraId],
  );

  useEffect(() => {
    setMensagem(null);
    void carregar();
  }, [carregar]);

  const nomeObra = estado.tipo === 'pronto' ? estado.obra.nome : undefined;

  useEffect(() => {
    document.title = `${nomeObra ?? 'Obra'} · Portal de documentos Jotanunes`;
  }, [nomeObra]);

  function aoEnviar(obra: ObraPortal, documento: DocumentoSituacaoPortal, envio: EnvioPortal) {
    setEstado((atual) =>
      atual.tipo !== 'pronto' || atual.obra.id !== obra.id
        ? atual
        : {
            ...atual,
            documentos: atual.documentos.map((d) =>
              d.tipoDocumento.id === documento.tipoDocumento.id
                ? { ...d, situacao: 'EM_ANALISE', envioAtual: envio, podeEnviar: false }
                : d,
            ),
          },
    );
    setMensagem(
      `Recebemos o arquivo de ${documento.tipoDocumento.nome} da obra ${obra.nome}. Agora é com a Jotanunes: a situação muda para "Aprovado" ou "Rejeitado" depois da análise.`,
    );
    refTitulo.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  const voltar = (
    <Link to="/documentos" className="jn-voltar">
      <IconeSetaEsquerda tamanho={16} />
      Voltar para o resumo
    </Link>
  );

  if (estado.tipo === 'nao-encontrada') {
    return (
      <div className="jn-container jn-pagina">
        {voltar}
        <TituloPagina>Obra não encontrada</TituloPagina>
        <Alerta tipo="erro" titulo="Não encontramos esta obra entre as obras da sua empresa.">
          Ela pode ter sido encerrada pela Jotanunes. Volte para o resumo para ver as suas obras.
        </Alerta>
      </div>
    );
  }

  const documentos = estado.tipo === 'pronto' ? estado.documentos : [];
  const n = (s: SituacaoDocumento) => documentos.filter((d) => d.situacao === s).length;
  const precisamDeAcao = n('REJEITADO') + n('PENDENTE_ENVIO');
  const tudoAprovado = documentos.length > 0 && n('APROVADO') === documentos.length;

  return (
    <div className="jn-container jn-pagina">
      {voltar}

      {estado.tipo === 'carregando' && <Carregando texto="Carregando os documentos da obra…" />}

      {estado.tipo === 'erro' && (
        <div className="jn-pagina__erro">
          <TituloPagina>Documentos da obra</TituloPagina>
          <Alerta tipo="erro" titulo="Não conseguimos carregar os documentos desta obra.">
            {estado.mensagem}
          </Alerta>
          <Botao variante="secundario" onClick={() => void carregar()}>
            Tentar de novo
          </Botao>
        </div>
      )}

      {estado.tipo === 'pronto' && (
        <>
          <ContextoObra obra={estado.obra} />
          <div ref={refTitulo}>
            <TituloPagina
              subtitulo={`${estado.obra.cidade}/${estado.obra.uf} · Documentos que esta obra pede da sua empresa.`}
            >
              {estado.obra.nome}
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

          {documentos.length === 0 ? (
            <p className="jn-secao__vazio" role="status">
              Nenhum documento exigido nesta obra.
            </p>
          ) : tudoAprovado ? (
            <div className="jn-vazio" role="status">
              <p className="jn-vazio__titulo">Tudo certo nesta obra.</p>
              <p className="jn-vazio__texto">
                Os arquivos enviados continuam no histórico de cada documento.
              </p>
            </div>
          ) : precisamDeAcao > 0 ? (
            <p className="jn-pagina__orientacao">
              {precisamDeAcao === 1
                ? 'Falta 1 documento nesta obra.'
                : `Faltam ${precisamDeAcao} documentos nesta obra.`}{' '}
              Envie cada um em PDF, JPG ou PNG, com até 10 MB.
            </p>
          ) : (
            <p className="jn-pagina__orientacao">
              Nenhum documento pendente nesta obra. Os arquivos enviados estão em análise.
            </p>
          )}

          {documentos.length > 0 && (
            <ul className="jn-grade" aria-label={`Documentos exigidos na obra ${estado.obra.nome}`}>
              {documentos.map((documento) => (
                <li key={documento.tipoDocumento.id}>
                  <CartaoDocumento
                    documento={documento}
                    obraId={estado.obra.id}
                    linkHistorico={caminhoDocumento(estado.obra.id, documento.tipoDocumento.id)}
                    aoEnviar={(envio) => aoEnviar(estado.obra, documento, envio)}
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
