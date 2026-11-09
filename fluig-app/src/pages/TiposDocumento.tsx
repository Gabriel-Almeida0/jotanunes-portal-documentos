import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ehSemPermissao, mensagemDeErro } from '../api/client';
import { api } from '../api/fluig';
import type { Abrangencia, TipoDocumento } from '../api/tipos';
import { useConsulta } from '../api/useConsulta';
import { AvisoPagina } from '../components/AvisoPagina';
import { AvisoSomenteAdmin } from '../components/AvisoSomenteAdmin';
import { Botao } from '../components/Botao';
import { CampoSelecao } from '../components/Campo';
import { Carregando, EstadoErro, EstadoVazio } from '../components/Estados';
import { Filtros } from '../components/Filtros';
import { FormularioTipo } from '../components/FormularioTipo';
import { IconeLapis, IconeMais } from '../components/icons';
import { ModalConfirmacao } from '../components/Modal';
import { SeloAbrangencia, SeloAtivo } from '../components/Selo';
import { SomenteAdmin } from '../components/SomenteAdmin';
import { Tabela } from '../components/Tabela';
import { TituloPagina } from '../components/TituloPagina';
import { useEhAdmin } from '../auth/contexto';
import { useAviso } from '../hooks/useAviso';
import { formatarData } from '../utils/datas';
import { ehPeriodico, periodicidadeDeEntrada, textoPeriodicidade } from '../utils/periodicidade';
import './TiposDocumento.css';

type FiltroSituacao = 'todos' | 'ativos' | 'inativos';
type FiltroAbrangencia = 'todas' | Abrangencia;
type FiltroPeriodicidade = 'todas' | 'unicos' | 'periodicos';

function resumir(texto: string | null | undefined, max = 110): string {
  if (!texto) return '';
  return texto.length > max ? `${texto.slice(0, max - 1).trimEnd()}…` : texto;
}

export function TiposDocumento() {
  const [params, setParams] = useSearchParams();
  const situacao = (params.get('situacao') as FiltroSituacao | null) ?? 'todos';
  const abrangenciaParam = params.get('abrangencia');
  const abrangencia: FiltroAbrangencia =
    abrangenciaParam === 'GERAL' || abrangenciaParam === 'POR_OBRA' ? abrangenciaParam : 'todas';
  const [rascunho, setRascunho] = useState<FiltroSituacao>(situacao);
  const [rascunhoAbrangencia, setRascunhoAbrangencia] = useState<FiltroAbrangencia>(abrangencia);
  const periodicidadeParam = params.get('periodicidade');
  const periodicidade: FiltroPeriodicidade =
    periodicidadeParam === 'unicos' || periodicidadeParam === 'periodicos' ? periodicidadeParam : 'todas';
  const [rascunhoPeriodicidade, setRascunhoPeriodicidade] = useState<FiltroPeriodicidade>(periodicidade);
  const [aviso, mostrarAviso] = useAviso();
  const [editando, setEditando] = useState<TipoDocumento | 'novo' | null>(null);
  const [alternando, setAlternando] = useState<TipoDocumento | null>(null);
  const ehAdmin = useEhAdmin();

  const ativo = situacao === 'ativos' ? true : situacao === 'inativos' ? false : undefined;
  const filtroAbrangencia = abrangencia === 'todas' ? undefined : abrangencia;
  const periodico = periodicidade === 'periodicos' ? true : periodicidade === 'unicos' ? false : undefined;
  const consulta = useConsulta(
    (sinal) => api.listarTipos({ ativo, abrangencia: filtroAbrangencia, periodico }, sinal),
    [ativo, filtroAbrangencia, periodico],
  );
  const filtrado = situacao !== 'todos' || abrangencia !== 'todas' || periodicidade !== 'todas';

  function pesquisar() {
    const novo = new URLSearchParams(params);
    if (rascunho === 'todos') novo.delete('situacao');
    else novo.set('situacao', rascunho);
    if (rascunhoAbrangencia === 'todas') novo.delete('abrangencia');
    else novo.set('abrangencia', rascunhoAbrangencia);
    if (rascunhoPeriodicidade === 'todas') novo.delete('periodicidade');
    else novo.set('periodicidade', rascunhoPeriodicidade);
    setParams(novo);
  }

  function limpar() {
    setRascunho('todos');
    setRascunhoAbrangencia('todas');
    setRascunhoPeriodicidade('todas');
    setParams(new URLSearchParams());
  }

  function aoSalvar(tipo: TipoDocumento, novo: boolean) {
    setEditando(null);
    mostrarAviso({
      tom: 'sucesso',
      texto: !novo
        ? `Alterações em "${tipo.nome}" salvas.`
        : tipo.abrangencia === 'GERAL'
          ? 'Tipo de documento cadastrado. Ele já passa a ser exigido de todas as empresas ativas.'
          : 'Tipo de documento cadastrado. Marque-o nas obras que o exigem, na aba "Documentos exigidos" de cada obra.',
    });
    consulta.recarregar();
  }

  /** 403 SEM_PERMISSAO: fecha o modal e mostra a mensagem, mantendo a lista. */
  function semPermissao(mensagem: string) {
    setEditando(null);
    setAlternando(null);
    mostrarAviso({ tom: 'erro', texto: mensagem });
  }

  const tipos = consulta.dados ?? [];

  return (
    <>
      <TituloPagina
        titulo="Tipos de documento"
        descricao="Os documentos que a Jotanunes exige. Tipos gerais são pedidos de todas as empresas ativas; tipos por obra, só nas obras que os marcarem."
        acoes={
          <SomenteAdmin>
            <Botao icone={<IconeMais tamanho={18} />} onClick={() => setEditando('novo')}>
              Novo tipo de documento
            </Botao>
          </SomenteAdmin>
        }
      />

      <AvisoSomenteAdmin />

      <Filtros titulo="Encontre o documento" onPesquisar={pesquisar} onLimpar={filtrado ? limpar : undefined}>
        <CampoSelecao
          rotulo="Situação"
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value as FiltroSituacao)}
        >
          <option value="todos">Todos</option>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
        </CampoSelecao>
        <CampoSelecao
          rotulo="Abrangência"
          value={rascunhoAbrangencia}
          onChange={(e) => setRascunhoAbrangencia(e.target.value as FiltroAbrangencia)}
        >
          <option value="todas">Todas</option>
          <option value="GERAL">Geral da empresa</option>
          <option value="POR_OBRA">Por obra</option>
        </CampoSelecao>
        <CampoSelecao
          rotulo="Periodicidade"
          value={rascunhoPeriodicidade}
          onChange={(e) => setRascunhoPeriodicidade(e.target.value as FiltroPeriodicidade)}
        >
          <option value="todas">Todas</option>
          <option value="unicos">Únicos</option>
          <option value="periodicos">Periódicos</option>
        </CampoSelecao>
      </Filtros>

      <AvisoPagina aviso={aviso} onFechar={() => mostrarAviso(null)} />

      {consulta.carregando && !consulta.dados ? (
        <Carregando texto="Carregando tipos de documento…" />
      ) : consulta.erro ? (
        <EstadoErro erro={consulta.erro} onTentarDeNovo={consulta.recarregar} />
      ) : tipos.length === 0 ? (
        !filtrado ? (
          <EstadoVazio
            titulo="Nenhum tipo de documento cadastrado."
            texto={
              ehAdmin
                ? 'Cadastre os documentos que as empresas precisam enviar, como Cartão CNPJ ou ASO.'
                : 'Quando um administrador cadastrar os documentos exigidos, eles aparecem aqui.'
            }
            acao={
              ehAdmin ? (
                <Botao icone={<IconeMais tamanho={18} />} onClick={() => setEditando('novo')}>
                  Novo tipo de documento
                </Botao>
              ) : undefined
            }
          />
        ) : (
          <EstadoVazio titulo="Nenhum tipo encontrado com esse filtro." acao={<Botao variante="secundario" onClick={limpar}>Limpar filtro</Botao>} />
        )
      ) : (
        <Tabela rotulo="Tipos de documento">
          <thead>
            <tr>
              <th scope="col">Documento</th>
              <th scope="col">Abrangência</th>
              <th scope="col">Periodicidade</th>
              <th scope="col">Situação</th>
              <th scope="col">Cadastrado em</th>
              {ehAdmin ? (
                <th scope="col" className="jn-tabela__acoes">
                  <span className="jn-sr-only">Ações</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {tipos.map((t) => (
              <tr key={t.id}>
                <td className="jn-tipos__celula-nome">
                  <span className="jn-tabela__principal">{t.nome}</span>
                  <span className="jn-tabela__sub">{resumir(t.instrucoes) || 'Sem instruções para a empresa.'}</span>
                </td>
                <td>
                  <SeloAbrangencia abrangencia={t.abrangencia} />
                </td>
                <td>
                  <span className={ehPeriodico(t.periodicidade) ? undefined : 'jn-texto-secundario'}>
                    {textoPeriodicidade(t.periodicidade)}
                  </span>
                </td>
                <td>
                  <SeloAtivo ativo={t.ativo} />
                </td>
                <td className="jn-tabela__nowrap">{formatarData(t.criadoEm)}</td>
                {ehAdmin ? (
                  <td className="jn-tabela__acoes">
                    <span className="jn-acoes-linha">
                      <Botao
                        variante="fantasma"
                        tamanho="pequeno"
                        icone={<IconeLapis tamanho={16} />}
                        onClick={() => setEditando(t)}
                        aria-label={`Editar ${t.nome}`}
                      >
                        Editar
                      </Botao>
                      <Botao
                        variante="fantasma"
                        tamanho="pequeno"
                        onClick={() => setAlternando(t)}
                        aria-label={`${t.ativo ? 'Desativar' : 'Ativar'} ${t.nome}`}
                      >
                        {t.ativo ? 'Desativar' : 'Ativar'}
                      </Botao>
                    </span>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Tabela>
      )}

      {editando ? (
        <FormularioTipo
          tipo={editando === 'novo' ? null : editando}
          onFechar={() => setEditando(null)}
          onSalvo={aoSalvar}
          onSemPermissao={semPermissao}
        />
      ) : null}

      <ConfirmarAlternancia
        tipo={alternando}
        onFechar={() => setAlternando(null)}
        onSemPermissao={semPermissao}
        onConcluido={(tipo) => {
          setAlternando(null);
          consulta.definirDados(tipos.map((x) => (x.id === tipo.id ? tipo : x)));
          mostrarAviso({
            tom: 'sucesso',
            texto: tipo.ativo ? `"${tipo.nome}" voltou a ser exigido.` : `"${tipo.nome}" foi desativado.`,
          });
        }}
      />
    </>
  );
}

function ConfirmarAlternancia({
  tipo,
  onFechar,
  onConcluido,
  onSemPermissao,
}: {
  tipo: TipoDocumento | null;
  onFechar: () => void;
  onConcluido: (tipo: TipoDocumento) => void;
  onSemPermissao: (mensagem: string) => void;
}) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    if (!tipo) return;
    setCarregando(true);
    setErro(null);
    try {
      const atualizado = await api.atualizarTipo(tipo.id, {
        nome: tipo.nome,
        instrucoes: tipo.instrucoes ?? null,
        abrangencia: tipo.abrangencia,
        // Omitida = UNICA (contrato): reenvia a atual para não perder a periodicidade.
        periodicidade: periodicidadeDeEntrada(tipo.periodicidade),
        ativo: !tipo.ativo,
      });
      onConcluido(atualizado);
    } catch (e) {
      if (ehSemPermissao(e)) onSemPermissao(e.title);
      else setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }

  const desativar = tipo?.ativo ?? true;
  return (
    <ModalConfirmacao
      aberto={Boolean(tipo)}
      titulo={desativar ? 'Desativar tipo de documento?' : 'Ativar tipo de documento?'}
      mensagem={
        desativar ? (
          <p>
            <strong>{tipo?.nome}</strong>.{' '}
            {tipo?.abrangencia === 'POR_OBRA'
              ? 'Este tipo deixa de ser exigido das empresas em todas as obras que o marcaram (as marcações ficam guardadas).'
              : 'Este tipo deixa de ser exigido das empresas.'}{' '}
            Os envios já feitos continuam no histórico.
          </p>
        ) : tipo?.abrangencia === 'POR_OBRA' ? (
          <p>
            <strong>{tipo?.nome}</strong> volta a ser exigido nas obras que o marcaram e aparece como “Pendente de
            envio” para as empresas dessas obras que ainda não enviaram.
          </p>
        ) : (
          <p>
            <strong>{tipo?.nome}</strong> volta a ser exigido de todas as empresas ativas e aparece como “Pendente de
            envio” para quem ainda não enviou.
          </p>
        )
      }
      rotuloConfirmar={desativar ? 'Desativar' : 'Ativar'}
      variante={desativar ? 'perigo' : 'primario'}
      carregando={carregando}
      erro={erro}
      onConfirmar={confirmar}
      onCancelar={() => {
        setErro(null);
        onFechar();
      }}
    />
  );
}
