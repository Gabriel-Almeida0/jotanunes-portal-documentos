import { Link } from 'react-router-dom';
import type { DocumentoSituacaoPortal, EnvioPortal } from '../api/tipos';
import { formatarDataHora, formatarTamanho } from '../utils/datas';
import { caminhoPeriodos, type ObraIdOuGeral } from '../utils/contexto';
import { ehPeriodico, textoPrazo, textoResumoPeriodos } from '../utils/periodos';
import { BotaoBaixar } from './BotaoBaixar';
import { EnvioArquivo } from './EnvioArquivo';
import { IconeArquivo, IconeSetaDireita } from './icons';
import { Selo } from './Selo';
import './Botao.css';
import './CartaoDocumento.css';

interface Props {
  documento: DocumentoSituacaoPortal;
  /** Obra do documento (`null` = geral): define para onde vai o envio. */
  obraId?: ObraIdOuGeral;
  /** Link do histórico de envios deste documento, no contexto certo (geral ou obra). */
  linkHistorico: string;
  aoEnviar: (envio: EnvioPortal) => void;
  aoDesatualizar: () => void;
}

const PROXIMO_PASSO = {
  PENDENTE_ENVIO: null,
  REJEITADO: null,
  EM_ANALISE: 'A Jotanunes está analisando este arquivo. Você recebe a resposta por aqui.',
  APROVADO: null,
} as const;

export function CartaoDocumento({
  documento,
  obraId = null,
  linkHistorico,
  aoEnviar,
  aoDesatualizar,
}: Props) {
  const { tipoDocumento, situacao, envioAtual, podeEnviar } = documento;
  const idTitulo = `doc-${obraId ?? 'geral'}-${tipoDocumento.id}`;
  const rejeitado = situacao === 'REJEITADO';

  if (ehPeriodico(documento)) {
    return <CartaoPeriodico documento={documento} obraId={obraId} idTitulo={idTitulo} />;
  }

  return (
    <article
      className={`jn-doc jn-doc--${situacao.toLowerCase()}`}
      aria-labelledby={idTitulo}
      data-testid="cartao-documento"
    >
      <div className="jn-doc__topo">
        <Selo situacao={situacao} />
        <h3 id={idTitulo} className="jn-doc__nome">
          {tipoDocumento.nome}
        </h3>
      </div>

      {tipoDocumento.instrucoes && <p className="jn-doc__instrucoes">{tipoDocumento.instrucoes}</p>}

      {rejeitado && envioAtual?.motivoRejeicao && (
        <div className="jn-doc__motivo">
          <p>
            <strong>Motivo:</strong> {envioAtual.motivoRejeicao}
          </p>
          <p className="jn-doc__motivo-dica">Corrija e envie um novo arquivo.</p>
        </div>
      )}

      {envioAtual && (
        <div className="jn-doc__envio">
          <IconeArquivo className="jn-doc__envio-icone" />
          <div className="jn-doc__envio-dados">
            <span className="jn-doc__envio-rotulo">
              {rejeitado ? 'Arquivo recusado' : 'Arquivo enviado'}
            </span>
            <BotaoBaixar envio={envioAtual} />
            <span className="jn-doc__envio-meta">
              {formatarTamanho(envioAtual.tamanhoBytes)} · enviado em{' '}
              {formatarDataHora(envioAtual.enviadoEm)}
            </span>
            {situacao === 'APROVADO' && envioAtual.analisadoEm && (
              <span className="jn-doc__envio-meta">
                Aprovado em {formatarDataHora(envioAtual.analisadoEm)}
              </span>
            )}
          </div>
        </div>
      )}

      {PROXIMO_PASSO[situacao] && <p className="jn-doc__passo">{PROXIMO_PASSO[situacao]}</p>}

      <div className="jn-doc__rodape">
        {podeEnviar && (
          <EnvioArquivo
            tipoDocumento={tipoDocumento}
            obraId={obraId}
            rotulo={rejeitado ? 'Enviar novo arquivo' : 'Enviar documento'}
            aoEnviar={aoEnviar}
            aoDesatualizar={aoDesatualizar}
          />
        )}
        {envioAtual && (
          <Link className="jn-doc__historico" to={linkHistorico}>
            Ver histórico de envios
            <span className="jn-visually-hidden"> de {tipoDocumento.nome}</span>
            <IconeSetaDireita tamanho={16} />
          </Link>
        )}
      </div>
    </article>
  );
}

/**
 * Documento periódico: o envio é por período, então o cartão resume os períodos e leva à página
 * de períodos (sem envio direto aqui).
 */
function CartaoPeriodico({
  documento,
  obraId,
  idTitulo,
}: {
  documento: DocumentoSituacaoPortal;
  obraId: ObraIdOuGeral;
  idTitulo: string;
}) {
  const { tipoDocumento, situacao, atrasado, periodos } = documento;
  const resumo = periodos ? textoResumoPeriodos(periodos) : '';
  const proximo = periodos?.proximo;
  const classe = atrasado ? 'rejeitado' : situacao.toLowerCase();

  return (
    <article
      className={`jn-doc jn-doc--${classe}`}
      aria-labelledby={idTitulo}
      data-testid="cartao-documento"
    >
      <div className="jn-doc__topo">
        <Selo situacao={situacao} atrasado={atrasado} />
        <h3 id={idTitulo} className="jn-doc__nome">
          {tipoDocumento.nome}
        </h3>
        {tipoDocumento.periodicidade.descricao && (
          <p className="jn-doc__periodicidade">{tipoDocumento.periodicidade.descricao}</p>
        )}
      </div>

      {tipoDocumento.instrucoes && <p className="jn-doc__instrucoes">{tipoDocumento.instrucoes}</p>}

      <div className="jn-doc__periodos">
        {resumo && <p className="jn-doc__resumo">{resumo}</p>}
        <p className={`jn-doc__proximo${proximo && atrasado ? ' jn-doc__proximo--atrasado' : ''}`}>
          {proximo
            ? `Próximo: ${proximo.rotulo} · ${textoPrazo(proximo)}`
            : 'Nenhum período para enviar agora.'}
        </p>
      </div>

      <div className="jn-doc__rodape">
        <Link
          className={`jn-botao jn-botao--${documento.podeEnviar ? 'primario' : 'secundario'} jn-doc__ver-periodos`}
          to={caminhoPeriodos(obraId, tipoDocumento.id)}
        >
          <span>
            Ver períodos
            <span className="jn-visually-hidden"> de {tipoDocumento.nome}</span>
          </span>
          <IconeSetaDireita tamanho={16} />
        </Link>
      </div>
    </article>
  );
}
