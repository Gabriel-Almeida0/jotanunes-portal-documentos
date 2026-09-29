import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/fluig';
import { useConsulta } from '../api/useConsulta';
import { useEhAdmin } from '../auth/contexto';
import { AvisoPagina } from '../components/AvisoPagina';
import { AvisoSomenteAdmin } from '../components/AvisoSomenteAdmin';
import { Botao } from '../components/Botao';
import { Campo, CampoSelecao } from '../components/Campo';
import { Carregando, EstadoErro, EstadoVazio } from '../components/Estados';
import { Filtros } from '../components/Filtros';
import { FormularioObra } from '../components/FormularioObra';
import { IconeMais, IconeObra, IconePin, IconeSeta } from '../components/icons';
import { Paginacao } from '../components/Paginacao';
import { SeloAtivo } from '../components/Selo';
import { SomenteAdmin } from '../components/SomenteAdmin';
import { Tabela } from '../components/Tabela';
import { TituloPagina } from '../components/TituloPagina';
import { useAviso } from '../hooks/useAviso';

type FiltroSituacao = 'ativas' | 'inativas' | 'todas';
const TAMANHO_PAGINA = 20;

export function Obras() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const busca = params.get('busca') ?? '';
  const situacao = (params.get('situacao') as FiltroSituacao | null) ?? 'ativas';
  const pagina = Math.max(1, Number(params.get('pagina') ?? '1') || 1);

  const [rascunhoBusca, setRascunhoBusca] = useState(busca);
  const [rascunhoSituacao, setRascunhoSituacao] = useState<FiltroSituacao>(situacao);
  const [criando, setCriando] = useState(false);
  const [aviso, mostrarAviso] = useAviso();
  const ehAdmin = useEhAdmin();

  const ativa = situacao === 'ativas' ? true : situacao === 'inativas' ? false : undefined;
  const consulta = useConsulta(
    (sinal) => api.listarObras({ busca: busca || undefined, ativa, pagina, tamanhoPagina: TAMANHO_PAGINA }, sinal),
    [busca, ativa, pagina],
  );

  function aplicar(novoBusca: string, novaSituacao: FiltroSituacao, novaPagina = 1) {
    const novo = new URLSearchParams();
    if (novoBusca.trim()) novo.set('busca', novoBusca.trim());
    if (novaSituacao !== 'ativas') novo.set('situacao', novaSituacao);
    if (novaPagina > 1) novo.set('pagina', String(novaPagina));
    setParams(novo);
  }

  const filtrado = Boolean(busca) || situacao !== 'ativas';
  const obras = consulta.dados?.itens ?? [];

  return (
    <>
      <TituloPagina
        titulo="Obras"
        descricao={
          ehAdmin
            ? 'Cadastre as obras e indique quais empresas atuam em cada uma.'
            : 'As obras da Jotanunes e as empresas que atuam em cada uma.'
        }
        acoes={
          <SomenteAdmin>
            <Botao icone={<IconeMais tamanho={18} />} onClick={() => setCriando(true)}>
              Nova obra
            </Botao>
          </SomenteAdmin>
        }
      />

      <AvisoSomenteAdmin />

      <Filtros
        titulo="Encontre a obra"
        onPesquisar={() => aplicar(rascunhoBusca, rascunhoSituacao)}
        onLimpar={
          filtrado
            ? () => {
                setRascunhoBusca('');
                setRascunhoSituacao('ativas');
                aplicar('', 'ativas');
              }
            : undefined
        }
      >
        <Campo
          rotulo="Buscar"
          type="search"
          placeholder="Nome, código ou cidade"
          maxLength={100}
          value={rascunhoBusca}
          onChange={(e) => setRascunhoBusca(e.target.value)}
        />
        <CampoSelecao
          rotulo="Situação"
          value={rascunhoSituacao}
          onChange={(e) => setRascunhoSituacao(e.target.value as FiltroSituacao)}
        >
          <option value="ativas">Ativas</option>
          <option value="inativas">Inativas</option>
          <option value="todas">Todas</option>
        </CampoSelecao>
      </Filtros>

      <AvisoPagina aviso={aviso} onFechar={() => mostrarAviso(null)} />

      {consulta.carregando && !consulta.dados ? (
        <Carregando texto="Carregando obras…" />
      ) : consulta.erro ? (
        <EstadoErro erro={consulta.erro} onTentarDeNovo={consulta.recarregar} />
      ) : obras.length === 0 ? (
        filtrado ? (
          <EstadoVazio titulo="Nenhuma obra encontrada com esses filtros." texto="Tente outro nome, código ou cidade." />
        ) : (
          <EstadoVazio
            icone={<IconeObra tamanho={32} />}
            titulo="Nenhuma obra cadastrada ainda."
            texto={
              ehAdmin
                ? 'Comece cadastrando a obra; depois vincule as empresas que trabalham nela.'
                : 'Quando um administrador cadastrar as obras, elas aparecem aqui.'
            }
            acao={
              ehAdmin ? (
                <Botao icone={<IconeMais tamanho={18} />} onClick={() => setCriando(true)}>
                  Nova obra
                </Botao>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <Tabela rotulo="Obras">
            <thead>
              <tr>
                <th scope="col">Obra</th>
                <th scope="col">Local</th>
                <th scope="col" className="jn-tabela__num">
                  Empresas
                </th>
                <th scope="col">Situação</th>
                <th scope="col" className="jn-tabela__acoes">
                  <span className="jn-sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {obras.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link to={`/obras/${o.id}`} className="jn-tabela__principal">
                      {o.nome}
                    </Link>
                    <span className="jn-tabela__sub">{o.codigo ? `Código ${o.codigo}` : 'Sem código'}</span>
                  </td>
                  <td>
                    <span className="jn-local">
                      <IconePin tamanho={16} /> {o.cidade}/{o.uf}
                    </span>
                  </td>
                  <td className="jn-tabela__num">{o.quantidadeEmpresas}</td>
                  <td>
                    <SeloAtivo ativo={o.ativa} feminino />
                  </td>
                  <td className="jn-tabela__acoes">
                    <Link className="jn-link-acao" to={`/obras/${o.id}`} aria-label={`Ver obra ${o.nome}`}>
                      Ver obra <IconeSeta tamanho={16} />
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
            rotuloItens="obras"
            onMudar={(p) => aplicar(busca, situacao, p)}
          />
        </>
      )}

      {criando ? (
        <FormularioObra
          obra={null}
          onFechar={() => setCriando(false)}
          onSemPermissao={(mensagem) => {
            setCriando(false);
            mostrarAviso({ tom: 'erro', texto: mensagem });
          }}
          onSalvo={(obra) =>
            navigate(`/obras/${obra.id}`, {
              state: { aviso: { tom: 'sucesso', texto: 'Obra cadastrada. Agora vincule as empresas que trabalham nela.' } },
            })
          }
        />
      ) : null}
    </>
  );
}
