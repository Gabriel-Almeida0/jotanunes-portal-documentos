import { useState } from 'react';
import { Link } from 'react-router-dom';
import { mensagemDeErro } from '../api/client';
import { api } from '../api/fluig';
import type { Envio } from '../api/tipos';
import { formatarDataHora } from '../utils/datas';
import { formatarTamanho } from '../utils/formatos';
import { Alerta } from './Alerta';
import { Botao } from './Botao';
import { IconeAbrir, IconeSeta } from './icons';
import { SeloComAtraso, SeloSituacao } from './Selo';
import './HistoricoEnvios.css';

/**
 * Lista de envios de um documento (mais recente primeiro): situação escrita, arquivo, quem analisou
 * e quando, motivo da rejeição e o botão para abrir o arquivo. `envioAtualId` destaca o envio que
 * está aberto na tela (detalhe da análise) e dá link para os demais.
 */
export function HistoricoEnvios({
  envios,
  rotulo = 'Envios',
  envioAtualId,
}: {
  envios: Envio[];
  rotulo?: string;
  envioAtualId?: string;
}) {
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
    <>
      {erroArquivo ? <Alerta tom="erro">{erroArquivo}</Alerta> : null}
      <ol className="jn-historico" aria-label={rotulo}>
        {envios.map((envio) => {
          const atual = envio.id === envioAtualId;
          return (
            <li key={envio.id} className={`jn-historico__item ${atual ? 'jn-historico__item--atual' : ''}`.trim()}>
              <div className="jn-historico__topo">
                <span className="jn-selos">
                  <SeloSituacao situacao={envio.status} />
                  {envio.enviadoComAtraso ? <SeloComAtraso /> : null}
                </span>
                {envio.periodo ? <span className="jn-historico__periodo">Período: {envio.periodo.rotulo}</span> : null}
                <span className="jn-meta">
                  {atual ? 'Este envio · ' : ''}Enviado em {formatarDataHora(envio.enviadoEm)}
                </span>
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
              <div className="jn-historico__acoes">
                {atual ? null : (
                  <Botao variante="fantasma" tamanho="pequeno" icone={<IconeAbrir tamanho={16} />} onClick={() => abrir(envio)}>
                    Abrir arquivo
                  </Botao>
                )}
                {envioAtualId && !atual ? (
                  <Link className="jn-link-acao" to={`/analise/${envio.id}`}>
                    Ver envio <IconeSeta tamanho={16} />
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
