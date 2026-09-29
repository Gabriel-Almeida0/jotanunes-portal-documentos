import { Link } from 'react-router-dom';
import type { DocumentoSituacaoPortal, EnvioPortal } from '../api/tipos';
import { formatarDataHora, formatarTamanho } from '../utils/datas';
import { BotaoBaixar } from './BotaoBaixar';
import { EnvioArquivo } from './EnvioArquivo';
import { IconeArquivo, IconeSetaDireita } from './icons';
import { Selo } from './Selo';
import './CartaoDocumento.css';

interface Props {
  documento: DocumentoSituacaoPortal;
  aoEnviar: (envio: EnvioPortal) => void;
  aoDesatualizar: () => void;
}

const PROXIMO_PASSO = {
  PENDENTE_ENVIO: null,
  REJEITADO: null,
  EM_ANALISE: 'A Jotanunes está analisando este arquivo. Você recebe a resposta por aqui.',
  APROVADO: null,
} as const;

export function CartaoDocumento({ documento, aoEnviar, aoDesatualizar }: Props) {
  const { tipoDocumento, situacao, envioAtual, podeEnviar } = documento;
  const idTitulo = `doc-${tipoDocumento.id}`;
  const rejeitado = situacao === 'REJEITADO';

  return (
    <article
      className={`jn-doc jn-doc--${situacao.toLowerCase()}`}
      aria-labelledby={idTitulo}
      data-testid="cartao-documento"
    >
      <div className="jn-doc__topo">
        <Selo situacao={situacao} />
        <h2 id={idTitulo} className="jn-doc__nome">
          {tipoDocumento.nome}
        </h2>
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
            rotulo={rejeitado ? 'Enviar novo arquivo' : 'Enviar documento'}
            aoEnviar={aoEnviar}
            aoDesatualizar={aoDesatualizar}
          />
        )}
        {envioAtual && (
          <Link className="jn-doc__historico" to={`/documentos/${tipoDocumento.id}`}>
            Ver histórico de envios
            <span className="jn-visually-hidden"> de {tipoDocumento.nome}</span>
            <IconeSetaDireita tamanho={16} />
          </Link>
        )}
      </div>
    </article>
  );
}
