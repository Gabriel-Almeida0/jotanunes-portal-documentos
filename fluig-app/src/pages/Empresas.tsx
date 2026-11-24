import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/fluig';
import type { ObraResumo, SituacaoAcesso } from '../api/tipos';
import { ehSemPermissao } from '../api/client';
import { useConsulta } from '../api/useConsulta';
import { useEhAdmin } from '../auth/contexto';
import { Alerta } from '../components/Alerta';
import { AvisoPagina } from '../components/AvisoPagina';
import { AvisoSomenteAdmin } from '../components/AvisoSomenteAdmin';
import { Botao } from '../components/Botao';
import { Campo, CampoSelecao } from '../components/Campo';
import { Carregando, EstadoErro, EstadoVazio } from '../components/Estados';
import { Filtros } from '../components/Filtros';
import { CamposEmpresa } from '../components/FormularioEmpresa';
import { useFormularioEmpresa } from '../hooks/useFormularioEmpresa';
import { IconeEmpresa, IconeMais, IconeSeta } from '../components/icons';
import { Modal } from '../components/Modal';
import { Paginacao } from '../components/Paginacao';
import { ResumoDocumentos } from '../components/ResumoDocumentos';
import { SeloSituacao } from '../components/Selo';
import { SITUACOES } from '../components/situacoes';
import { SomenteAdmin } from '../components/SomenteAdmin';
import { Tabela } from '../components/Tabela';
import { TituloPagina } from '../components/TituloPagina';
import { useAviso } from '../hooks/useAviso';
import { useObraSelecionada } from '../obra/contexto';
import { formatarCnpj } from '../utils/cnpj';

const TAMANHO_PAGINA = 20;
const SITUACOES_ACESSO: SituacaoAcesso[] = ['NAO_CONVIDADA', 'CONVIDADA', 'CONVITE_EXPIRADO', 'ATIVA', 'DESATIVADA'];

/** A obra não é filtro da página: vem do filtro geral (menu lateral). */
interface FiltrosEmpresas {
  busca: string;
  situacaoAcesso: string;
  comPendencia: boolean;
}

function lerFiltros(params: URLSearchParams): FiltrosEmpresas {
  const situacao = params.get('situacaoAcesso') ?? '';
  return {
    busca: params.get('busca') ?? '',
    situacaoAcesso: SITUACOES_ACESSO.includes(situacao as SituacaoAcesso) ? situacao : '',
    comPendencia: params.get('comPendencia') === 'true',
  };
}

export function Empresas() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filtros = lerFiltros(params);
  const pagina = Math.max(1, Number(params.get('pagina') ?? '1') || 1);
  const [rascunho, setRascunho] = useState<FiltrosEmpresas>(filtros);
  const [criando, setCriando] = useState(false);
  const [aviso, mostrarAviso] = useAviso();
  const ehAdmin = useEhAdmin();

  // Mantém o rascunho alinhado quando a URL muda por fora (ex.: link do painel).
  const chaveUrl = params.toString();
  const [chaveAnterior, setChaveAnterior] = useState(chaveUrl);
  if (chaveUrl !== chaveAnterior) {
    setChaveAnterior(chaveUrl);
    setRascunho(filtros);
  }

  const { obraId, obra } = useObraSelecionada();
  const consulta = useConsulta(
    (sinal) =>
      api.listarEmpresas(
        {
          busca: filtros.busca || undefined,
          obraId: obraId || undefined,
          situacaoAcesso: (filtros.situacaoAcesso || undefined) as SituacaoAcesso | undefined,
          comPendencia: filtros.comPendencia || undefined,
          pagina,
          tamanhoPagina: TAMANHO_PAGINA,
        },
        sinal,
      ),
    [filtros.busca, obraId, filtros.situacaoAcesso, filtros.comPendencia, pagina],
  );

  function aplicar(f: FiltrosEmpresas, novaPagina = 1) {
    const novo = new URLSearchParams();
    if (f.busca.trim()) novo.set('busca', f.busca.trim());
    if (f.situacaoAcesso) novo.set('situacaoAcesso', f.situacaoAcesso);
    if (f.comPendencia) novo.set('comPendencia', 'true');
    if (novaPagina > 1) novo.set('pagina', String(novaPagina));
    setParams(novo);
  }

  const vazio: FiltrosEmpresas = { busca: '', situacaoAcesso: '', comPendencia: false };
  const filtrado = Boolean(filtros.busca || filtros.situacaoAcesso || filtros.comPendencia);
  const empresas = consulta.dados?.itens ?? [];

  return (
    <>
      <TituloPagina
        titulo="Empresas"
        descricao={
          obra
            ? `Empresas terceirizadas vinculadas à obra ${obra.nome}, situação de acesso ao portal e andamento dos documentos.`
            : 'Empresas terceirizadas, situação de acesso ao portal e andamento dos documentos.'
        }
        acoes={
          <SomenteAdmin>
            <Botao icone={<IconeMais tamanho={18} />} onClick={() => setCriando(true)}>
              Nova empresa
            </Botao>
          </SomenteAdmin>
        }
      />

      <AvisoSomenteAdmin />

      <Filtros
        titulo="Encontre a empresa"
        onPesquisar={() => aplicar(rascunho)}
        onLimpar={
          filtrado
            ? () => {
                setRascunho(vazio);
                aplicar(vazio);
              }
            : undefined
        }
      >
        <Campo
          rotulo="Buscar"
          type="search"
          placeholder="Nome ou CNPJ"
          maxLength={100}
          value={rascunho.busca}
          onChange={(e) => setRascunho({ ...rascunho, busca: e.target.value })}
        />
        <CampoSelecao
          rotulo="Situação de acesso"
          value={rascunho.situacaoAcesso}
          onChange={(e) => setRascunho({ ...rascunho, situacaoAcesso: e.target.value })}
        >
          <option value="">Todas</option>
          {SITUACOES_ACESSO.map((s) => (
            <option key={s} value={s}>
              {SITUACOES[s].texto}
            </option>
          ))}
        </CampoSelecao>
        <label className="jn-caixa-marcacao jn-empresas__pendencia">
          <input
            type="checkbox"
            checked={rascunho.comPendencia}
            onChange={(e) => setRascunho({ ...rascunho, comPendencia: e.target.checked })}
          />
          Com pendência
        </label>
      </Filtros>

      <AvisoPagina aviso={aviso} onFechar={() => mostrarAviso(null)} />

      {consulta.carregando && !consulta.dados ? (
        <Carregando texto="Carregando empresas…" />
      ) : consulta.erro ? (
        <EstadoErro erro={consulta.erro} onTentarDeNovo={consulta.recarregar} />
      ) : empresas.length === 0 ? (
        filtrado ? (
          <EstadoVazio titulo="Nenhuma empresa encontrada com esses filtros." texto="Confira a busca ou limpe os filtros." />
        ) : obra ? (
          <EstadoVazio
            icone={<IconeEmpresa tamanho={32} />}
            titulo={`Nenhuma empresa vinculada à obra ${obra.nome}.`}
            texto="Vincule empresas na página da obra ou escolha “Todas as obras” no menu lateral."
          />
        ) : (
          <EstadoVazio
            icone={<IconeEmpresa tamanho={32} />}
            titulo="Nenhuma empresa cadastrada ainda."
            texto={
              ehAdmin
                ? 'Cadastre a empresa terceirizada com razão social, CNPJ e e-mail de contato.'
                : 'Quando um administrador cadastrar as empresas, elas aparecem aqui.'
            }
            acao={
              ehAdmin ? (
                <Botao icone={<IconeMais tamanho={18} />} onClick={() => setCriando(true)}>
                  Nova empresa
                </Botao>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <Tabela rotulo="Empresas">
            <thead>
              <tr>
                <th scope="col">Empresa</th>
                <th scope="col">CNPJ</th>
                <th scope="col">Acesso ao portal</th>
                <th scope="col">Documentos</th>
                <th scope="col" className="jn-tabela__acoes">
                  <span className="jn-sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link to={`/empresas/${e.id}`} className="jn-tabela__principal">
                      {e.razaoSocial}
                    </Link>
                    <span className="jn-tabela__sub">{e.nomeFantasia || e.emailContato}</span>
                  </td>
                  <td className="jn-tabela__nowrap jn-mono">{formatarCnpj(e.cnpj)}</td>
                  <td>
                    <SeloSituacao situacao={e.situacaoAcesso} />
                  </td>
                  <td>
                    <ResumoDocumentos contagem={e.documentos} />
                  </td>
                  <td className="jn-tabela__acoes">
                    <Link className="jn-link-acao" to={`/empresas/${e.id}`} aria-label={`Ver empresa ${e.razaoSocial}`}>
                      Ver empresa <IconeSeta tamanho={16} />
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
            rotuloItens="empresas"
            onMudar={(p) => aplicar(filtros, p)}
          />
        </>
      )}

      {criando ? (
        <NovaEmpresa
          obra={obra}
          onFechar={() => setCriando(false)}
          onSemPermissao={(mensagem) => {
            setCriando(false);
            mostrarAviso({ tom: 'erro', texto: mensagem });
          }}
          onCriada={(id, vinculadaA) =>
            navigate(`/empresas/${id}`, {
              state: {
                aviso: {
                  tom: 'sucesso',
                  texto: vinculadaA
                    ? `Empresa cadastrada e vinculada à obra ${vinculadaA}. Envie o convite para o portal.`
                    : 'Empresa cadastrada. Vincule a empresa a uma obra e envie o convite para o portal.',
                },
              },
            })
          }
        />
      ) : null}
    </>
  );
}

function NovaEmpresa({
  obra,
  onFechar,
  onCriada,
  onSemPermissao,
}: {
  /** Obra do filtro geral: a nova empresa já nasce vinculada a ela (se a opção ficar marcada). */
  obra: ObraResumo | undefined;
  onFechar: () => void;
  onCriada: (id: string, vinculadaA: string | null) => void;
  onSemPermissao: (mensagem: string) => void;
}) {
  const form = useFormularioEmpresa(null);
  const [salvando, setSalvando] = useState(false);
  const [vincular, setVincular] = useState(true);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const dados = form.validar();
    if (!dados) return;
    setSalvando(true);
    try {
      const criada = await api.criarEmpresa(dados);
      let vinculadaA: string | null = null;
      if (obra && vincular) {
        // Se o vínculo falhar, a empresa já existe: segue para a página dela, onde dá para vincular.
        try {
          await api.vincularEmpresa(obra.id, criada.id);
          vinculadaA = obra.nome;
        } catch {
          vinculadaA = null;
        }
      }
      onCriada(criada.id, vinculadaA);
    } catch (erro) {
      setSalvando(false);
      if (ehSemPermissao(erro)) onSemPermissao(erro.title);
      else form.tratarErro(erro);
    }
  }

  return (
    <Modal
      aberto
      titulo="Nova empresa"
      onFechar={onFechar}
      bloqueado={salvando}
      largura="larga"
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao type="submit" form="jn-form-empresa" carregando={salvando} textoCarregando="Salvando…">
            Salvar
          </Botao>
        </>
      }
    >
      <form id="jn-form-empresa" className="jn-grade-form" onSubmit={salvar} noValidate>
        {form.erroGeral ? (
          <div className="jn-grade-form__inteiro">
            <Alerta tom="erro">{form.erroGeral}</Alerta>
          </div>
        ) : null}
        <CamposEmpresa form={form} />
        {obra ? (
          <label className="jn-caixa-marcacao jn-grade-form__inteiro">
            <input type="checkbox" checked={vincular} onChange={(e) => setVincular(e.target.checked)} />
            Vincular à obra {obra.nome}
          </label>
        ) : null}
      </form>
    </Modal>
  );
}
