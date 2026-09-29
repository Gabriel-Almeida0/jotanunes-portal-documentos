import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErroApi, ehSemPermissao, mensagemDeErro } from '../api/client';
import { api } from '../api/fluig';
import type { EmpresaNaObra, EmpresaResumo, ObraDetalhe as TObraDetalhe } from '../api/tipos';
import { useConsulta } from '../api/useConsulta';
import { useEhAdmin } from '../auth/contexto';
import { Alerta } from '../components/Alerta';
import { AvisoPagina } from '../components/AvisoPagina';
import { AvisoSomenteAdmin } from '../components/AvisoSomenteAdmin';
import { Botao, BotaoLink } from '../components/Botao';
import { Campo } from '../components/Campo';
import { Carregando, EstadoErro, EstadoVazio } from '../components/Estados';
import { FormularioObra } from '../components/FormularioObra';
import { IconeEmpresa, IconeLapis, IconeMais, IconePin, IconeSeta } from '../components/icons';
import { Modal, ModalConfirmacao } from '../components/Modal';
import { ResumoDocumentos } from '../components/ResumoDocumentos';
import { SeloAtivo, SeloSituacao } from '../components/Selo';
import { SomenteAdmin } from '../components/SomenteAdmin';
import { Tabela } from '../components/Tabela';
import { TituloPagina } from '../components/TituloPagina';
import { useAviso } from '../hooks/useAviso';
import { formatarCnpj } from '../utils/cnpj';
import { formatarData } from '../utils/datas';
import './ObraDetalhe.css';

export function ObraDetalhe() {
  const { obraId = '' } = useParams();
  const consulta = useConsulta((sinal) => api.obterObra(obraId, sinal), [obraId]);
  const [aviso, mostrarAviso] = useAviso();
  const [editando, setEditando] = useState(false);
  const [alternando, setAlternando] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [desvinculando, setDesvinculando] = useState<EmpresaNaObra | null>(null);
  const ehAdmin = useEhAdmin();

  if (consulta.carregando && !consulta.dados) return <Carregando texto="Carregando obra…" />;
  if (consulta.erro || !consulta.dados) {
    const naoEncontrada = consulta.erro instanceof ErroApi && consulta.erro.status === 404;
    return (
      <>
        <TituloPagina titulo="Obra" voltar={{ para: '/obras', rotulo: 'Obras' }} />
        <EstadoErro erro={consulta.erro} onTentarDeNovo={naoEncontrada ? undefined : consulta.recarregar} />
      </>
    );
  }

  const obra = consulta.dados;

  /** 403 SEM_PERMISSAO: fecha o modal aberto e mostra a mensagem, mantendo os dados da obra. */
  function semPermissao(mensagem: string) {
    setEditando(false);
    setAlternando(false);
    setVinculando(false);
    setDesvinculando(null);
    mostrarAviso({ tom: 'erro', texto: mensagem });
  }

  return (
    <>
      <TituloPagina
        titulo={obra.nome}
        voltar={{ para: '/obras', rotulo: 'Obras' }}
        acoes={
          <SomenteAdmin>
            <Botao variante="secundario" icone={<IconeLapis tamanho={18} />} onClick={() => setEditando(true)}>
              Editar dados
            </Botao>
            <Botao variante="fantasma" onClick={() => setAlternando(true)}>
              {obra.ativa ? 'Desativar obra' : 'Ativar obra'}
            </Botao>
          </SomenteAdmin>
        }
      >
        <SeloAtivo ativo={obra.ativa} feminino />
        <span className="jn-meta jn-local">
          <IconePin tamanho={16} /> {obra.cidade}/{obra.uf}
        </span>
        <span className="jn-meta">{obra.codigo ? `Código ${obra.codigo}` : 'Sem código'}</span>
        <span className="jn-meta">Cadastrada em {formatarData(obra.criadoEm)}</span>
      </TituloPagina>

      <AvisoSomenteAdmin />

      <AvisoPagina aviso={aviso} onFechar={() => mostrarAviso(null)} />

      {!obra.ativa ? (
        <div className="jn-avisos">
          <Alerta tom="info">Esta obra está inativa. Ela não aparece nos filtros padrão, mas os vínculos continuam.</Alerta>
        </div>
      ) : null}

      <section className="jn-secao" aria-labelledby="jn-empresas-da-obra">
        <div className="jn-secao__cabecalho">
          <div>
            <h2 className="jn-secao__titulo" id="jn-empresas-da-obra">
              Empresas da obra
            </h2>
            <p className="jn-secao__descricao">
              {obra.empresas.length === 1 ? '1 empresa vinculada' : `${obra.empresas.length} empresas vinculadas`}
            </p>
          </div>
          <SomenteAdmin>
            <Botao icone={<IconeMais tamanho={18} />} onClick={() => setVinculando(true)}>
              Vincular empresa
            </Botao>
          </SomenteAdmin>
        </div>

        {obra.empresas.length === 0 ? (
          <EstadoVazio
            icone={<IconeEmpresa tamanho={32} />}
            titulo="Nenhuma empresa vinculada a esta obra."
            texto={
              ehAdmin
                ? 'Vincule as empresas terceirizadas que trabalham aqui para acompanhar os documentos delas.'
                : 'Quando um administrador vincular empresas a esta obra, elas aparecem aqui.'
            }
            acao={
              ehAdmin ? (
                <Botao icone={<IconeMais tamanho={18} />} onClick={() => setVinculando(true)}>
                  Vincular empresa
                </Botao>
              ) : undefined
            }
          />
        ) : (
          <Tabela rotulo="Empresas da obra">
            <thead>
              <tr>
                <th scope="col">Empresa</th>
                <th scope="col">Acesso ao portal</th>
                <th scope="col">Documentos</th>
                <th scope="col">Vinculada em</th>
                <th scope="col" className="jn-tabela__acoes">
                  <span className="jn-sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {obra.empresas.map((e) => (
                <tr key={e.empresaId}>
                  <td>
                    <Link to={`/empresas/${e.empresaId}`} className="jn-tabela__principal">
                      {e.razaoSocial}
                    </Link>
                    <span className="jn-tabela__sub jn-mono">{formatarCnpj(e.cnpj)}</span>
                  </td>
                  <td>
                    <SeloSituacao situacao={e.situacaoAcesso} />
                  </td>
                  <td>
                    <ResumoDocumentos contagem={e.documentos} />
                  </td>
                  <td className="jn-tabela__nowrap">{formatarData(e.vinculadoEm)}</td>
                  <td className="jn-tabela__acoes">
                    <span className="jn-acoes-linha">
                      <Link className="jn-link-acao" to={`/empresas/${e.empresaId}`} aria-label={`Ver empresa ${e.razaoSocial}`}>
                        Ver empresa <IconeSeta tamanho={16} />
                      </Link>
                      <SomenteAdmin>
                        <Botao
                          variante="fantasma"
                          tamanho="pequeno"
                          onClick={() => setDesvinculando(e)}
                          aria-label={`Desvincular ${e.razaoSocial}`}
                        >
                          Desvincular
                        </Botao>
                      </SomenteAdmin>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </section>

      {editando ? (
        <FormularioObra
          obra={obra}
          onFechar={() => setEditando(false)}
          onSemPermissao={semPermissao}
          onSalvo={(salva) => {
            setEditando(false);
            consulta.definirDados({ ...obra, ...salva });
            mostrarAviso({ tom: 'sucesso', texto: 'Dados da obra salvos.' });
          }}
        />
      ) : null}

      <AlternarObra
        obra={alternando ? obra : null}
        onFechar={() => setAlternando(false)}
        onSemPermissao={semPermissao}
        onConcluido={(ativa) => {
          setAlternando(false);
          consulta.definirDados({ ...obra, ativa });
          mostrarAviso({ tom: 'sucesso', texto: ativa ? 'Obra ativada.' : 'Obra desativada.' });
        }}
      />

      {vinculando ? (
        <ModalVincularEmpresa
          obra={obra}
          onFechar={() => setVinculando(false)}
          onSemPermissao={semPermissao}
          onVinculada={(empresa) => {
            setVinculando(false);
            consulta.recarregar();
            mostrarAviso({ tom: 'sucesso', texto: `${empresa.razaoSocial} foi vinculada à obra.` });
          }}
        />
      ) : null}

      <Desvincular
        obraId={obra.id}
        empresa={desvinculando}
        onFechar={() => setDesvinculando(null)}
        onSemPermissao={semPermissao}
        onConcluido={(empresa) => {
          setDesvinculando(null);
          consulta.definirDados({ ...obra, empresas: obra.empresas.filter((x) => x.empresaId !== empresa.empresaId) });
          mostrarAviso({ tom: 'sucesso', texto: `${empresa.razaoSocial} foi desvinculada da obra.` });
        }}
      />
    </>
  );
}

function AlternarObra({
  obra,
  onFechar,
  onConcluido,
  onSemPermissao,
}: {
  obra: TObraDetalhe | null;
  onFechar: () => void;
  onConcluido: (ativa: boolean) => void;
  onSemPermissao: (mensagem: string) => void;
}) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const desativar = obra?.ativa ?? true;

  async function confirmar() {
    if (!obra) return;
    setCarregando(true);
    setErro(null);
    try {
      const salva = await api.atualizarObra(obra.id, {
        nome: obra.nome,
        codigo: obra.codigo ?? null,
        cidade: obra.cidade,
        uf: obra.uf,
        ativa: !obra.ativa,
      });
      onConcluido(salva.ativa);
    } catch (e) {
      if (ehSemPermissao(e)) onSemPermissao(e.title);
      else setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <ModalConfirmacao
      aberto={Boolean(obra)}
      titulo={desativar ? 'Desativar obra?' : 'Ativar obra?'}
      mensagem={
        desativar
          ? 'A obra sai dos filtros padrão. Os vínculos com as empresas e o histórico continuam guardados.'
          : 'A obra volta a aparecer nas listas e filtros.'
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

function Desvincular({
  obraId,
  empresa,
  onFechar,
  onConcluido,
  onSemPermissao,
}: {
  obraId: string;
  empresa: EmpresaNaObra | null;
  onFechar: () => void;
  onConcluido: (empresa: EmpresaNaObra) => void;
  onSemPermissao: (mensagem: string) => void;
}) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    if (!empresa) return;
    setCarregando(true);
    setErro(null);
    try {
      await api.desvincularEmpresa(obraId, empresa.empresaId);
      onConcluido(empresa);
    } catch (e) {
      if (ehSemPermissao(e)) onSemPermissao(e.title);
      else setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <ModalConfirmacao
      aberto={Boolean(empresa)}
      titulo="Desvincular empresa?"
      mensagem={
        <p>
          <strong>{empresa?.razaoSocial}</strong> deixa de aparecer nesta obra. Os documentos e o acesso da empresa ao
          portal não mudam.
        </p>
      }
      rotuloConfirmar="Desvincular"
      variante="perigo"
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

function ModalVincularEmpresa({
  obra,
  onFechar,
  onVinculada,
  onSemPermissao,
}: {
  obra: TObraDetalhe;
  onFechar: () => void;
  onVinculada: (empresa: EmpresaResumo) => void;
  onSemPermissao: (mensagem: string) => void;
}) {
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');
  const [vinculandoId, setVinculandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setTermo(busca.trim()), 300);
    return () => window.clearTimeout(t);
  }, [busca]);

  const resultados = useConsulta(
    (sinal) => api.listarEmpresas({ busca: termo || undefined, tamanhoPagina: 8 }, sinal),
    [termo],
  );
  const vinculadas = new Set(obra.empresas.map((e) => e.empresaId));

  async function vincular(empresa: EmpresaResumo) {
    setVinculandoId(empresa.id);
    setErro(null);
    try {
      await api.vincularEmpresa(obra.id, empresa.id);
      onVinculada(empresa);
    } catch (e) {
      setVinculandoId(null);
      if (ehSemPermissao(e)) onSemPermissao(e.title);
      else setErro(mensagemDeErro(e));
    }
  }

  const itens = resultados.dados?.itens ?? [];
  const total = resultados.dados?.total ?? 0;

  return (
    <Modal aberto titulo="Vincular empresa à obra" onFechar={onFechar} bloqueado={Boolean(vinculandoId)} largura="larga">
      <p className="jn-texto-secundario">
        Busque a empresa pelo nome ou CNPJ. Não encontrou? Cadastre antes em <Link to="/empresas">Empresas</Link>.
      </p>
      <Campo
        rotulo="Buscar empresa"
        type="search"
        placeholder="Razão social, nome fantasia ou CNPJ"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        maxLength={100}
        autoComplete="off"
      />
      {erro ? <Alerta tom="erro">{erro}</Alerta> : null}
      <div aria-live="polite" aria-busy={resultados.carregando}>
        {resultados.carregando && !resultados.dados ? (
          <Carregando texto="Buscando empresas…" />
        ) : resultados.erro ? (
          <EstadoErro erro={resultados.erro} onTentarDeNovo={resultados.recarregar} />
        ) : itens.length === 0 ? (
          <p className="jn-vincular__vazio">Nenhuma empresa encontrada.</p>
        ) : (
          <>
            <ul className="jn-lista-simples jn-vincular__lista" aria-label="Empresas encontradas">
              {itens.map((e) => {
                const jaVinculada = vinculadas.has(e.id);
                return (
                  <li key={e.id}>
                    <div className="jn-vincular__empresa">
                      <span className="jn-tabela__principal">{e.razaoSocial}</span>
                      <span className="jn-tabela__sub jn-mono">
                        {formatarCnpj(e.cnpj)}
                        {!e.ativa ? ' · Desativada' : ''}
                      </span>
                    </div>
                    {jaVinculada ? (
                      <span className="jn-vincular__ja">Já vinculada</span>
                    ) : (
                      <Botao
                        tamanho="pequeno"
                        variante="secundario"
                        carregando={vinculandoId === e.id}
                        disabled={Boolean(vinculandoId)}
                        onClick={() => vincular(e)}
                        aria-label={`Vincular ${e.razaoSocial}`}
                      >
                        Vincular
                      </Botao>
                    )}
                  </li>
                );
              })}
            </ul>
            {total > itens.length ? (
              <p className="jn-vincular__mais">
                Mostrando {itens.length} de {total}. Refine a busca para achar mais rápido.
              </p>
            ) : null}
          </>
        )}
      </div>
      <div className="jn-vincular__rodape">
        <BotaoLink variante="fantasma" to="/empresas">
          Cadastrar nova empresa
        </BotaoLink>
      </div>
    </Modal>
  );
}
