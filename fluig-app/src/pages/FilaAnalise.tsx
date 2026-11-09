import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, listarTodasEmpresas, listarTodasObras } from '../api/fluig';
import type { StatusEnvio } from '../api/tipos';
import { useConsulta } from '../api/useConsulta';
import { useEhAdmin } from '../auth/contexto';
import { AvisoPagina } from '../components/AvisoPagina';
import { AvisoSomenteAdmin } from '../components/AvisoSomenteAdmin';
import { CampoSelecao } from '../components/Campo';
import { Carregando, EstadoErro, EstadoVazio } from '../components/Estados';
import { Filtros } from '../components/Filtros';
import { IconeFila, IconeSeta } from '../components/icons';
import { Paginacao } from '../components/Paginacao';
import { SeloComAtraso, SeloSituacao } from '../components/Selo';
import { Tabela } from '../components/Tabela';
import { TituloPagina } from '../components/TituloPagina';
import { useAviso } from '../hooks/useAviso';
import { formatarCnpj } from '../utils/cnpj';
import { formatarDataHora, tempoDecorrido } from '../utils/datas';
import { formatarTamanho } from '../utils/formatos';
import './FilaAnalise.css';

const TAMANHO_PAGINA = 20;
const STATUS: { valor: StatusEnvio; rotulo: string }[] = [
  { valor: 'EM_ANALISE', rotulo: 'Em análise' },
  { valor: 'APROVADO', rotulo: 'Aprovados' },
  { valor: 'REJEITADO', rotulo: 'Rejeitados' },
];

/** Valor do select "Obra" para "Somente gerais" (vira `somenteGerais=true` na URL e na API). */
const SOMENTE_GERAIS = '__gerais';

interface FiltrosFila {
  status: StatusEnvio;
  /** Id da obra, `SOMENTE_GERAIS` ou vazio (todas). */
  obraId: string;
  empresaId: string;
  tipoDocumentoId: string;
  /** 003: só envios feitos depois do prazo do período. */
  comAtraso: boolean;
}

function lerFiltros(params: URLSearchParams): FiltrosFila {
  const status = params.get('status') as StatusEnvio | null;
  return {
    status: status && STATUS.some((s) => s.valor === status) ? status : 'EM_ANALISE',
    obraId: params.get('somenteGerais') === 'true' ? SOMENTE_GERAIS : (params.get('obraId') ?? ''),
    empresaId: params.get('empresaId') ?? '',
    tipoDocumentoId: params.get('tipoDocumentoId') ?? '',
    comAtraso: params.get('comAtraso') === 'true',
  };
}

export function FilaAnalise() {
  const [params, setParams] = useSearchParams();
  const filtros = lerFiltros(params);
  const pagina = Math.max(1, Number(params.get('pagina') ?? '1') || 1);
  const [rascunho, setRascunho] = useState<FiltrosFila>(filtros);
  const [aviso, mostrarAviso] = useAviso();

  const obras = useConsulta((s) => listarTodasObras(s), []);
  const empresas = useConsulta((s) => listarTodasEmpresas(s), []);
  const tipos = useConsulta((s) => api.listarTipos({}, s), []);

  const somenteGerais = filtros.obraId === SOMENTE_GERAIS;
  const consulta = useConsulta(
    (sinal) =>
      api.listarEnvios(
        {
          status: filtros.status,
          obraId: (!somenteGerais && filtros.obraId) || undefined,
          somenteGerais: somenteGerais || undefined,
          empresaId: filtros.empresaId || undefined,
          tipoDocumentoId: filtros.tipoDocumentoId || undefined,
          comAtraso: filtros.comAtraso || undefined,
          pagina,
          tamanhoPagina: TAMANHO_PAGINA,
        },
        sinal,
      ),
    [filtros.status, filtros.obraId, filtros.empresaId, filtros.tipoDocumentoId, filtros.comAtraso, pagina],
  );

  function aplicar(f: FiltrosFila, novaPagina = 1) {
    const novo = new URLSearchParams();
    if (f.status !== 'EM_ANALISE') novo.set('status', f.status);
    if (f.obraId === SOMENTE_GERAIS) novo.set('somenteGerais', 'true');
    else if (f.obraId) novo.set('obraId', f.obraId);
    if (f.empresaId) novo.set('empresaId', f.empresaId);
    if (f.tipoDocumentoId) novo.set('tipoDocumentoId', f.tipoDocumentoId);
    if (f.comAtraso) novo.set('comAtraso', 'true');
    if (novaPagina > 1) novo.set('pagina', String(novaPagina));
    setParams(novo);
  }

  const vazio: FiltrosFila = { status: 'EM_ANALISE', obraId: '', empresaId: '', tipoDocumentoId: '', comAtraso: false };
  const filtrado = Boolean(filtros.obraId || filtros.empresaId || filtros.tipoDocumentoId || filtros.comAtraso);
  const naFila = filtros.status === 'EM_ANALISE';
  const ehAdmin = useEhAdmin();
  /** Mesma rota para os dois perfis; só o administrador decide, então só ele "analisa". */
  const rotuloLink = naFila && ehAdmin ? 'Analisar' : 'Ver';
  const envios = consulta.dados?.itens ?? [];

  return (
    <>
      <TituloPagina
        titulo="Fila de análise"
        descricao={
          naFila
            ? ehAdmin
              ? 'Documentos enviados pelas empresas, do mais antigo para o mais novo. Abra, confira e decida.'
              : 'Documentos enviados pelas empresas, do mais antigo para o mais novo.'
            : 'Envios já analisados, do mais recente para o mais antigo.'
        }
      />

      <AvisoSomenteAdmin />

      <Filtros
        titulo="Encontre o envio"
        onPesquisar={() => aplicar(rascunho)}
        onLimpar={
          filtrado || !naFila
            ? () => {
                setRascunho(vazio);
                aplicar(vazio);
              }
            : undefined
        }
      >
        <CampoSelecao
          rotulo="Situação"
          value={rascunho.status}
          onChange={(e) => setRascunho({ ...rascunho, status: e.target.value as StatusEnvio })}
        >
          {STATUS.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.rotulo}
            </option>
          ))}
        </CampoSelecao>
        <CampoSelecao
          rotulo="Obra"
          value={rascunho.obraId}
          onChange={(e) => setRascunho({ ...rascunho, obraId: e.target.value })}
        >
          <option value="">Todas as obras</option>
          <option value={SOMENTE_GERAIS}>Somente gerais</option>
          {(obras.dados ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.nome}
            </option>
          ))}
        </CampoSelecao>
        <CampoSelecao
          rotulo="Empresa"
          value={rascunho.empresaId}
          onChange={(e) => setRascunho({ ...rascunho, empresaId: e.target.value })}
        >
          <option value="">Todas as empresas</option>
          {(empresas.dados ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.razaoSocial}
            </option>
          ))}
        </CampoSelecao>
        <CampoSelecao
          rotulo="Documento"
          value={rascunho.tipoDocumentoId}
          onChange={(e) => setRascunho({ ...rascunho, tipoDocumentoId: e.target.value })}
        >
          <option value="">Todos os documentos</option>
          {(tipos.dados ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
              {t.ativo ? '' : ' (inativo)'}
            </option>
          ))}
        </CampoSelecao>
        <label className="jn-caixa-marcacao">
          <input
            type="checkbox"
            checked={rascunho.comAtraso}
            onChange={(e) => setRascunho({ ...rascunho, comAtraso: e.target.checked })}
          />
          Com atraso
        </label>
      </Filtros>

      <AvisoPagina aviso={aviso} onFechar={() => mostrarAviso(null)} />

      {consulta.carregando && !consulta.dados ? (
        <Carregando texto="Carregando envios…" />
      ) : consulta.erro ? (
        <EstadoErro erro={consulta.erro} onTentarDeNovo={consulta.recarregar} />
      ) : envios.length === 0 ? (
        naFila && !filtrado ? (
          <EstadoVazio
            icone={<IconeFila tamanho={32} />}
            titulo="Nenhum documento aguardando análise."
            texto="Quando uma empresa enviar um documento, ele aparece aqui."
          />
        ) : (
          <EstadoVazio titulo="Nenhum envio encontrado com esses filtros." texto="Tente outra obra, empresa, documento ou tire o filtro “Com atraso”." />
        )
      ) : (
        <>
          <Tabela rotulo={naFila ? 'Envios aguardando análise' : 'Envios analisados'}>
            <thead>
              <tr>
                <th scope="col">Empresa</th>
                <th scope="col">Documento</th>
                <th scope="col">Obra</th>
                <th scope="col">Arquivo</th>
                <th scope="col">Enviado em</th>
                {naFila ? null : <th scope="col">Situação</th>}
                <th scope="col" className="jn-tabela__acoes">
                  <span className="jn-sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {envios.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="jn-tabela__principal">{e.empresa.razaoSocial}</span>
                    <span className="jn-tabela__sub jn-mono">{formatarCnpj(e.empresa.cnpj)}</span>
                  </td>
                  <td>
                    <span>{e.tipoDocumento.nome}</span>
                    {e.periodo ? <span className="jn-tabela__sub">{e.periodo.rotulo}</span> : null}
                    {e.enviadoComAtraso ? <SeloComAtraso /> : null}
                  </td>
                  <td>
                    {e.obra ? (
                      <>
                        <span>{e.obra.nome}</span>
                        <span className="jn-tabela__sub">
                          {e.obra.cidade}/{e.obra.uf}
                        </span>
                      </>
                    ) : (
                      <span className="jn-texto-secundario">Geral da empresa</span>
                    )}
                  </td>
                  <td>
                    <span className="jn-fila__arquivo" title={e.nomeArquivo}>
                      {e.nomeArquivo}
                    </span>
                    <span className="jn-tabela__sub">{formatarTamanho(e.tamanhoBytes)}</span>
                  </td>
                  <td className="jn-tabela__nowrap">
                    {formatarDataHora(e.enviadoEm)}
                    {naFila ? <span className="jn-tabela__sub">{tempoDecorrido(e.enviadoEm)}</span> : null}
                  </td>
                  {naFila ? null : (
                    <td>
                      <SeloSituacao situacao={e.status} />
                    </td>
                  )}
                  <td className="jn-tabela__acoes">
                    <Link
                      className="jn-link-acao"
                      to={`/analise/${e.id}`}
                      aria-label={`${rotuloLink} ${e.tipoDocumento.nome}${e.periodo ? ` de ${e.periodo.rotulo}` : ''} de ${e.empresa.razaoSocial}${e.obra ? ` na obra ${e.obra.nome}` : ''}`}
                    >
                      {rotuloLink} <IconeSeta tamanho={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabela>
          <Paginacao
            pagina={consulta.dados?.pagina ?? pagina}
            tamanhoPagina={consulta.dados?.tamanhoPagina ?? TAMANHO_PAGINA}
            total={consulta.dados?.total ?? 0}
            rotuloItens="envios"
            onMudar={(p) => aplicar(filtros, p)}
          />
        </>
      )}
    </>
  );
}
