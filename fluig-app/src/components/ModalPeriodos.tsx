import { Link } from 'react-router-dom';
import { api } from '../api/fluig';
import type { ObraRef, Periodo, TipoDocumentoRef } from '../api/tipos';
import { useConsulta } from '../api/useConsulta';
import { useEhAdmin } from '../auth/contexto';
import { formatarDataHora } from '../utils/datas';
import { formatarDiaIso, textoPeriodicidade } from '../utils/periodicidade';
import { Carregando, EstadoErro } from './Estados';
import { IconeSeta } from './icons';
import { Modal } from './Modal';
import { SeloComAtraso, SeloSituacaoPeriodo } from './Selo';
import './ModalPeriodos.css';

const pedeAcao = (p: Periodo) => p.situacao === 'PENDENTE_ENVIO' || p.situacao === 'REJEITADO';

/**
 * Separa os períodos (já do mais recente ao mais antigo, como vêm da API) em: os que pedem ação
 * (atrasados primeiro, depois pendentes e rejeitados) + os em análise + o período em curso, nesta ordem; e os
 * anteriores já resolvidos, que ficam recolhidos (FR-331).
 */
function organizarPeriodos(periodos: Periodo[]): { principais: Periodo[]; anteriores: Periodo[] } {
  const emCurso = periodos[0];
  // Atrasados primeiro, depois os demais que pedem ação (cada grupo do mais recente ao mais antigo).
  const acao = [...periodos.filter((p) => p.atrasado), ...periodos.filter((p) => pedeAcao(p) && !p.atrasado)];
  const outros = periodos.filter((p) => !pedeAcao(p) && (p === emCurso || p.situacao === 'EM_ANALISE'));
  const principais = [...acao, ...outros];
  return { principais, anteriores: periodos.filter((p) => !principais.includes(p)) };
}

/**
 * Períodos de um documento periódico da empresa (003, US3): geral (`obra` null) ou de uma obra.
 * Mesma visão do portal, com quem analisou e o link para o envio.
 */
export function ModalPeriodos({
  empresaId,
  tipo,
  obra,
  onFechar,
}: {
  empresaId: string;
  tipo: TipoDocumentoRef;
  obra: ObraRef | null;
  onFechar: () => void;
}) {
  const obraId = obra?.id ?? null;
  const consulta = useConsulta(
    (sinal) =>
      obraId
        ? api.listarPeriodosEmpresaObra(obraId, empresaId, tipo.id, sinal)
        : api.listarPeriodosEmpresa(empresaId, tipo.id, sinal),
    [empresaId, tipo.id, obraId],
  );
  const periodos = consulta.dados ?? [];
  const { principais, anteriores } = organizarPeriodos(periodos);

  return (
    <Modal aberto titulo={`Períodos: ${tipo.nome}`} onFechar={onFechar} largura="larga">
      <p className="jn-texto-secundario">
        {textoPeriodicidade(tipo.periodicidade)}.{' '}
        {obra ? `Obra: ${obra.nome} (${obra.cidade}/${obra.uf}).` : 'Documento geral da empresa.'} Os que pedem ação
        aparecem primeiro.
      </p>
      {consulta.carregando && !consulta.dados ? (
        <Carregando texto="Carregando períodos…" />
      ) : consulta.erro ? (
        <EstadoErro erro={consulta.erro} onTentarDeNovo={consulta.recarregar} />
      ) : periodos.length === 0 ? (
        <p className="jn-texto-secundario">Nenhum período exigido ainda.</p>
      ) : (
        <>
          <ListaPeriodos periodos={principais} rotulo="Períodos" />
          {anteriores.length > 0 ? (
            <details className="jn-recolhivel jn-periodos__anteriores">
              <summary>
                Períodos anteriores ({anteriores.length})
                <span className="jn-recolhivel__resumo">— já resolvidos</span>
              </summary>
              <div className="jn-recolhivel__corpo">
                <ListaPeriodos periodos={anteriores} rotulo="Períodos anteriores" />
              </div>
            </details>
          ) : null}
        </>
      )}
    </Modal>
  );
}

function ListaPeriodos({ periodos, rotulo }: { periodos: Periodo[]; rotulo: string }) {
  const ehAdmin = useEhAdmin();
  return (
    <ol className="jn-periodos" aria-label={rotulo}>
      {periodos.map((p) => {
        const envio = p.envioAtual ?? null;
        const acao = ehAdmin && p.situacao === 'EM_ANALISE' ? 'Analisar' : 'Ver envio';
        return (
          <li
            key={p.inicio}
            className={`jn-periodos__item ${p.atrasado ? 'jn-periodos__item--atrasado' : ''}`.trim()}
            aria-label={p.rotulo}
          >
            <div className="jn-periodos__topo">
              <span className="jn-periodos__rotulo">{p.rotulo}</span>
              <SeloSituacaoPeriodo situacao={p.situacao} atrasado={p.atrasado} />
            </div>
            <p className="jn-meta">
              Prazo: {formatarDiaIso(p.prazo)} · {p.quantidadeEnvios === 1 ? '1 envio' : `${p.quantidadeEnvios} envios`}
            </p>
            {envio ? (
              <div className="jn-periodos__envio">
                <p>
                  <span className="jn-periodos__arquivo">{envio.nomeArquivo}</span> · Enviado em{' '}
                  {formatarDataHora(envio.enviadoEm)} {envio.enviadoComAtraso ? <SeloComAtraso /> : null}
                </p>
                {envio.analisadoEm ? (
                  <p>
                    {envio.status === 'APROVADO' ? 'Aprovado' : 'Rejeitado'} por{' '}
                    <strong>{envio.analisadoPor?.nome ?? '—'}</strong> em {formatarDataHora(envio.analisadoEm)}
                  </p>
                ) : (
                  <p className="jn-texto-secundario">Aguardando análise.</p>
                )}
                {envio.motivoRejeicao ? <p className="jn-periodos__motivo">Motivo: {envio.motivoRejeicao}</p> : null}
                <Link className="jn-link-acao" to={`/analise/${envio.id}`} aria-label={`${acao} de ${p.rotulo}`}>
                  {acao} <IconeSeta tamanho={16} />
                </Link>
              </div>
            ) : (
              <p className="jn-texto-secundario">Nenhum arquivo enviado para este período.</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
