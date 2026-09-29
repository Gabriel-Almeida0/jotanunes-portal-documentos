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
import { SeloSituacao } from '../components/Selo';
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

interface FiltrosFila {
  status: StatusEnvio;
  obraId: string;
  empresaId: string;
  tipoDocumentoId: string;
}

function lerFiltros(params: URLSearchParams): FiltrosFila {
  const status = params.get('status') as StatusEnvio | null;
  return {
    status: status && STATUS.some((s) => s.valor === status) ? status : 'EM_ANALISE',
    obraId: params.get('obraId') ?? '',
    empresaId: params.get('empresaId') ?? '',
    tipoDocumentoId: params.get('tipoDocumentoId') ?? '',
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

  const consulta = useConsulta(
    (sinal) =>
      api.listarEnvios(
        {
          status: filtros.status,
          obraId: filtros.obraId || undefined,
          empresaId: filtros.empresaId || undefined,
          tipoDocumentoId: filtros.tipoDocumentoId || undefined,
          pagina,
          tamanhoPagina: TAMANHO_PAGINA,
        },
        sinal,
      ),
    [filtros.status, filtros.obraId, filtros.empresaId, filtros.tipoDocumentoId, pagina],
  );

  function aplicar(f: FiltrosFila, novaPagina = 1) {
    const novo = new URLSearchParams();
    if (f.status !== 'EM_ANALISE') novo.set('status', f.status);
    if (f.obraId) novo.set('obraId', f.obraId);
    if (f.empresaId) novo.set('empresaId', f.empresaId);
    if (f.tipoDocumentoId) novo.set('tipoDocumentoId', f.tipoDocumentoId);
    if (novaPagina > 1) novo.set('pagina', String(novaPagina));
    setParams(novo);
  }

  const vazio: FiltrosFila = { status: 'EM_ANALISE', obraId: '', empresaId: '', tipoDocumentoId: '' };
  const filtrado = Boolean(filtros.obraId || filtros.empresaId || filtros.tipoDocumentoId);
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
          <EstadoVazio titulo="Nenhum envio encontrado com esses filtros." texto="Tente outra obra, empresa ou documento." />
        )
      ) : (
        <>
          <Tabela rotulo={naFila ? 'Envios aguardando análise' : 'Envios analisados'}>
            <thead>
              <tr>
                <th scope="col">Empresa</th>
                <th scope="col">Documento</th>
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
                  <td>{e.tipoDocumento.nome}</td>
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
                      aria-label={`${rotuloLink} ${e.tipoDocumento.nome} de ${e.empresa.razaoSocial}`}
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
