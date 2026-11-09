import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ErroApi } from '../api/client';
import { MENSAGENS } from '../api/mensagens';
import type { DocumentoSituacaoPortal, ObraPortal, PeriodoPortal } from '../api/tipos';
import { Alerta } from '../components/Alerta';
import { BotaoBaixar } from '../components/BotaoBaixar';
import { Botao } from '../components/Botao';
import { Carregando } from '../components/Carregando';
import { ContextoObra } from '../components/ContextoObra';
import { EnvioArquivo } from '../components/EnvioArquivo';
import { IconeArquivo, IconeSetaDireita, IconeSetaEsquerda } from '../components/icons';
import { Selo } from '../components/Selo';
import { TituloPagina } from '../components/TituloPagina';
import {
  caminhoHistoricoPeriodo,
  caminhoLista,
  listarDocumentos,
  listarPeriodos,
  type ObraIdOuGeral,
} from '../utils/contexto';
import { formatarData, formatarDataHora } from '../utils/datas';
import '../components/CartaoDocumento.css';
import './DocumentoHistorico.css';
import './PeriodosDocumento.css';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'erro'; mensagem: string; naoEncontrado: boolean }
  | {
      tipo: 'pronto';
      documento: DocumentoSituacaoPortal | null;
      periodos: PeriodoPortal[];
      obra: ObraPortal | null;
    };

/**
 * Separa a lista (já do mais recente ao mais antigo): em destaque os que pedem ação (pendente,
 * atrasado ou rejeitado) e o período mais recente; os demais, já resolvidos, ficam recolhidos.
 */
function separar(periodos: PeriodoPortal[]) {
  const [maisRecente] = periodos;
  const pedemAcao = periodos.filter((p) => p.podeEnviar);
  const destaque = maisRecente && !maisRecente.podeEnviar ? [...pedemAcao, maisRecente] : pedemAcao;
  const anteriores = periodos.filter((p) => !destaque.includes(p));
  return { destaque, anteriores };
}

/**
 * Períodos de um documento periódico (`/documentos/:tipo/periodos` ou
 * `/obras/:obraId/documentos/:tipo/periodos`), com o envio de cada período.
 */
export function PeriodosDocumento() {
  const { tipoDocumentoId = '', obraId: obraIdParam } = useParams();
  const obraId = obraIdParam ?? null;
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });
  const [mensagem, setMensagem] = useState<string | null>(null);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setEstado({ tipo: 'carregando' });
      try {
        const [documentos, periodos, obras] = await Promise.all([
          listarDocumentos(obraId),
          listarPeriodos(obraId, tipoDocumentoId),
          obraId ? api.listarObras() : Promise.resolve([]),
        ]);
        setEstado({
          tipo: 'pronto',
          documento: documentos.find((d) => d.tipoDocumento.id === tipoDocumentoId) ?? null,
          periodos: [...periodos].sort((a, b) => b.inicio.localeCompare(a.inicio)),
          obra: obras.find((o) => o.id === obraId) ?? null,
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
    },
    [obraId, tipoDocumentoId],
  );

  useEffect(() => {
    setMensagem(null);
    void carregar();
  }, [carregar]);

  const documento = estado.tipo === 'pronto' ? estado.documento : null;
  const obra = estado.tipo === 'pronto' ? estado.obra : null;
  const nome = documento?.tipoDocumento.nome;

  useEffect(() => {
    const titulo = [nome ? `Períodos de ${nome}` : 'Períodos do documento', obra?.nome]
      .filter(Boolean)
      .join(' · ');
    document.title = `${titulo} · Portal de documentos Jotanunes`;
  }, [nome, obra?.nome]);

  function aoEnviar(periodo: PeriodoPortal) {
    setMensagem(
      `Recebemos o arquivo de ${nome ?? 'documento'} de ${periodo.rotulo}${
        obra ? ` da obra ${obra.nome}` : ''
      }. Agora é com a Jotanunes.`,
    );
    void carregar(true);
  }

  return (
    <div className="jn-container jn-pagina jn-historico-pagina">
      <Link to={caminhoLista(obraId)} className="jn-voltar">
        <IconeSetaEsquerda tamanho={16} />
        {obraId
          ? obra
            ? `Voltar para a obra ${obra.nome}`
            : 'Voltar para a obra'
          : 'Voltar para meus documentos'}
      </Link>

      {obra && <ContextoObra obra={obra} />}

      {estado.tipo === 'carregando' && <Carregando texto="Carregando os períodos…" />}

      {estado.tipo === 'erro' && (
        <div className="jn-pagina__erro">
          <TituloPagina>Períodos do documento</TituloPagina>
          <Alerta tipo="erro" titulo={estado.mensagem} />
          {!estado.naoEncontrado && (
            <Botao variante="secundario" onClick={() => void carregar()}>
              Tentar de novo
            </Botao>
          )}
        </div>
      )}

      {estado.tipo === 'pronto' && (
        <ConteudoPeriodos
          documento={estado.documento}
          periodos={estado.periodos}
          obraId={obraId}
          tipoDocumentoId={tipoDocumentoId}
          mensagem={mensagem}
          aoFecharMensagem={() => setMensagem(null)}
          aoEnviar={aoEnviar}
          aoDesatualizar={() => void carregar(true)}
        />
      )}
    </div>
  );
}

interface PropsConteudo {
  documento: DocumentoSituacaoPortal | null;
  periodos: PeriodoPortal[];
  obraId: ObraIdOuGeral;
  tipoDocumentoId: string;
  mensagem: string | null;
  aoFecharMensagem: () => void;
  aoEnviar: (periodo: PeriodoPortal) => void;
  aoDesatualizar: () => void;
}

function ConteudoPeriodos({
  documento,
  periodos,
  obraId,
  tipoDocumentoId,
  mensagem,
  aoFecharMensagem,
  aoEnviar,
  aoDesatualizar,
}: PropsConteudo) {
  const tipo = documento?.tipoDocumento ?? { id: tipoDocumentoId, nome: 'Documento' };
  const { destaque, anteriores } = separar(periodos);
  const aEnviar = periodos.filter((p) => p.podeEnviar).length;
  const atrasados = periodos.filter((p) => p.atrasado).length;

  const item = (periodo: PeriodoPortal) => (
    <li key={periodo.inicio}>
      <ItemPeriodo
        periodo={periodo}
        tipoDocumento={tipo}
        obraId={obraId}
        aoEnviar={() => aoEnviar(periodo)}
        aoDesatualizar={aoDesatualizar}
      />
    </li>
  );

  return (
    <>
      <TituloPagina subtitulo={documento?.tipoDocumento.periodicidade.descricao}>
        {tipo.nome}
      </TituloPagina>
      {documento?.tipoDocumento.instrucoes && (
        <p className="jn-periodos__instrucoes">{documento.tipoDocumento.instrucoes}</p>
      )}

      <div className="jn-pagina__avisos" aria-live="polite">
        {mensagem && (
          <Alerta tipo="sucesso" titulo={mensagem}>
            <button type="button" className="jn-fechar" onClick={aoFecharMensagem}>
              Fechar aviso
            </button>
          </Alerta>
        )}
      </div>

      <p className="jn-pagina__orientacao">
        {aEnviar === 0
          ? 'Nenhum período para enviar agora.'
          : `${aEnviar === 1 ? '1 período pede' : `${aEnviar} períodos pedem`} envio${
              atrasados > 0 ? ` (${atrasados === 1 ? '1 atrasado' : `${atrasados} atrasados`})` : ''
            }. Envie cada arquivo no período certo, em PDF, JPG ou PNG, com até 10 MB.`}
      </p>

      {destaque.length > 0 && (
        <ul className="jn-periodos__lista" aria-label="Períodos">
          {destaque.map(item)}
        </ul>
      )}

      {anteriores.length > 0 && (
        <details className="jn-periodos__anteriores">
          <summary>Períodos anteriores ({anteriores.length})</summary>
          <ul className="jn-periodos__lista" aria-label="Períodos anteriores">
            {anteriores.map(item)}
          </ul>
        </details>
      )}
    </>
  );
}

interface PropsItem {
  periodo: PeriodoPortal;
  tipoDocumento: { id: string; nome: string };
  obraId: ObraIdOuGeral;
  aoEnviar: () => void;
  aoDesatualizar: () => void;
}

function ItemPeriodo({ periodo, tipoDocumento, obraId, aoEnviar, aoDesatualizar }: PropsItem) {
  const { envioAtual, situacao, atrasado } = periodo;
  const idTitulo = `periodo-${obraId ?? 'geral'}-${tipoDocumento.id}-${periodo.inicio}`;
  const rejeitado = situacao === 'REJEITADO';
  const classe = atrasado ? 'atrasado' : situacao.toLowerCase();

  return (
    <article className={`jn-periodo jn-periodo--${classe}`} aria-labelledby={idTitulo}>
      <div className="jn-periodo__cabeca">
        <h2 id={idTitulo} className="jn-periodo__rotulo">
          {periodo.rotulo}
        </h2>
        <Selo situacao={situacao} atrasado={atrasado} />
      </div>
      <p className={`jn-periodo__prazo${atrasado ? ' jn-periodo__prazo--vencido' : ''}`}>
        Prazo: {formatarData(periodo.prazo)}
      </p>

      {rejeitado && envioAtual?.motivoRejeicao && (
        <div className="jn-doc__motivo">
          <p>
            <strong>Motivo:</strong> {envioAtual.motivoRejeicao}
          </p>
          <p className="jn-doc__motivo-dica">Corrija e envie um novo arquivo.</p>
        </div>
      )}

      {envioAtual && (
        <div className="jn-periodo__envio">
          <IconeArquivo className="jn-doc__envio-icone" />
          <div className="jn-doc__envio-dados">
            <BotaoBaixar envio={envioAtual} />
            <span className="jn-doc__envio-meta">
              Enviado em {formatarDataHora(envioAtual.enviadoEm)}
            </span>
            {envioAtual.enviadoComAtraso && (
              <span className="jn-periodo__marca-atraso">Enviado com atraso</span>
            )}
          </div>
        </div>
      )}

      {periodo.podeEnviar && (
        <EnvioArquivo
          tipoDocumento={tipoDocumento}
          obraId={obraId}
          periodo={periodo}
          rotulo={rejeitado ? 'Enviar novo arquivo' : 'Enviar documento'}
          aoEnviar={aoEnviar}
          aoDesatualizar={aoDesatualizar}
        />
      )}

      {envioAtual && (
        <Link
          className="jn-doc__historico"
          to={caminhoHistoricoPeriodo(obraId, tipoDocumento.id, periodo.inicio)}
        >
          Ver histórico de envios
          <span className="jn-visually-hidden"> de {periodo.rotulo}</span>
          <IconeSetaDireita tamanho={16} />
        </Link>
      )}
    </article>
  );
}
