import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ErroApi, ehSemPermissao, mensagemDeErro } from '../api/client';
import { api } from '../api/fluig';
import type { EmpresaNaObra, EmpresaResumo, ObraDetalhe as TObraDetalhe, VinculoEncerrado } from '../api/tipos';
import { useConsulta } from '../api/useConsulta';
import { Alerta } from '../components/Alerta';
import { AvisoPagina } from '../components/AvisoPagina';
import { AvisoSomenteAdmin } from '../components/AvisoSomenteAdmin';
import { Botao, BotaoLink } from '../components/Botao';
import { Campo } from '../components/Campo';
import { Abas } from '../components/Abas';
import { Carregando, EstadoErro } from '../components/Estados';
import { FormularioObra } from '../components/FormularioObra';
import { IconeLapis, IconePin } from '../components/icons';
import { Modal, ModalConfirmacao } from '../components/Modal';
import { SeloAtivo } from '../components/Selo';
import { SomenteAdmin } from '../components/SomenteAdmin';
import { TituloPagina } from '../components/TituloPagina';
import { useAviso } from '../hooks/useAviso';
import { formatarCnpj } from '../utils/cnpj';
import { formatarData } from '../utils/datas';
import { AbaDocumentosExigidos } from './obra/AbaDocumentosExigidos';
import { AbaEmpresas } from './obra/AbaEmpresas';
import { AbaVinculosEncerrados } from './obra/AbaVinculosEncerrados';
import './ObraDetalhe.css';

type IdAba = 'empresas' | 'documentos' | 'encerrados';
const ABAS: IdAba[] = ['empresas', 'documentos', 'encerrados'];

export function ObraDetalhe() {
  const { obraId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const consulta = useConsulta((sinal) => api.obterObra(obraId, sinal), [obraId]);
  const [aviso, mostrarAviso] = useAviso();
  const [editando, setEditando] = useState(false);
  const [alternando, setAlternando] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [encerrando, setEncerrando] = useState<EmpresaNaObra | null>(null);
  const [reabrindoId, setReabrindoId] = useState<string | null>(null);

  const abaParam = params.get('aba') as IdAba | null;
  const aba: IdAba = abaParam && ABAS.includes(abaParam) ? abaParam : 'empresas';

  function trocarAba(id: string) {
    const novo = new URLSearchParams(params);
    if (id === 'empresas') novo.delete('aba');
    else novo.set('aba', id);
    setParams(novo, { replace: true });
  }

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
    setEncerrando(null);
    mostrarAviso({ tom: 'erro', texto: mensagem });
  }

  async function reabrir(v: VinculoEncerrado) {
    setReabrindoId(v.empresaId);
    try {
      await api.vincularEmpresa(obra.id, v.empresaId);
      consulta.recarregar();
      mostrarAviso({ tom: 'sucesso', texto: textoReaberto(v.razaoSocial) });
    } catch (e) {
      if (ehSemPermissao(e)) semPermissao(e.title);
      else mostrarAviso({ tom: 'erro', texto: mensagemDeErro(e) });
    } finally {
      setReabrindoId(null);
    }
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
          <Alerta tom="info">
            Esta obra está inativa. Os documentos dela saem do portal e das pendências; os vínculos e o histórico
            continuam guardados.
          </Alerta>
        </div>
      ) : null}

      <Abas
        rotulo="Seções da obra"
        ativa={aba}
        onTrocar={trocarAba}
        abas={[
          {
            id: 'empresas',
            rotulo: <RotuloAba texto="Empresas" contador={obra.empresas.length} />,
            conteudo: (
              <AbaEmpresas obra={obra} onVincular={() => setVinculando(true)} onEncerrar={setEncerrando} />
            ),
          },
          {
            id: 'documentos',
            rotulo: <RotuloAba texto="Documentos exigidos" contador={obra.quantidadeTiposExigidos} />,
            conteudo: (
              <AbaDocumentosExigidos obraId={obra.id} onAlterado={consulta.recarregar} onSemPermissao={semPermissao} />
            ),
          },
          {
            id: 'encerrados',
            rotulo: <RotuloAba texto="Vínculos encerrados" contador={obra.vinculosEncerrados.length} />,
            conteudo: <AbaVinculosEncerrados obra={obra} reabrindoId={reabrindoId} onReabrir={reabrir} />,
          },
        ]}
      />

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
          onVinculada={(empresa, reaberto) => {
            setVinculando(false);
            consulta.recarregar();
            mostrarAviso({
              tom: 'sucesso',
              texto: reaberto ? textoReaberto(empresa.razaoSocial) : `${empresa.razaoSocial} foi vinculada à obra.`,
            });
          }}
        />
      ) : null}

      <EncerrarVinculo
        obraId={obra.id}
        empresa={encerrando}
        onFechar={() => setEncerrando(null)}
        onSemPermissao={semPermissao}
        onConcluido={(empresa) => {
          setEncerrando(null);
          consulta.recarregar();
          mostrarAviso({
            tom: 'sucesso',
            texto: `O vínculo de ${empresa.razaoSocial} com a obra foi encerrado. O histórico está em “Vínculos encerrados”.`,
          });
        }}
      />
    </>
  );
}

function textoReaberto(razaoSocial: string): string {
  return `O vínculo de ${razaoSocial} com a obra foi reaberto. Os documentos e o histórico desta obra voltaram a valer.`;
}

function RotuloAba({ texto, contador }: { texto: string; contador: number }) {
  return (
    <>
      {texto}
      <span className="jn-abas__contador" aria-label={`(${contador})`}>
        {contador}
      </span>
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

function textoEnviosNaObra(n: number): string {
  if (n === 0) return 'A empresa ainda não enviou documentos nesta obra.';
  if (n === 1) return 'A empresa já enviou 1 documento nesta obra.';
  return `A empresa já enviou ${n} documentos nesta obra.`;
}

/** Desvincular encerra o vínculo e preserva o histórico (US5, FR-220/FR-222). */
function EncerrarVinculo({
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
      titulo="Encerrar vínculo?"
      mensagem={
        <>
          <p>
            <strong>{empresa?.razaoSocial}</strong> deixa de ver esta obra no portal e sai das pendências dela.
          </p>
          <p>
            {textoEnviosNaObra(empresa?.quantidadeEnviosNaObra ?? 0)} O histórico continua guardado e volta se você
            vincular de novo.
          </p>
        </>
      }
      rotuloConfirmar="Encerrar vínculo"
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
  onVinculada: (empresa: EmpresaResumo, reaberto: boolean) => void;
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
  const encerradas = new Set(obra.vinculosEncerrados.map((v) => v.empresaId));

  async function vincular(empresa: EmpresaResumo) {
    setVinculandoId(empresa.id);
    setErro(null);
    try {
      await api.vincularEmpresa(obra.id, empresa.id);
      onVinculada(empresa, encerradas.has(empresa.id));
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
                const encerrada = encerradas.has(e.id);
                return (
                  <li key={e.id}>
                    <div className="jn-vincular__empresa">
                      <span className="jn-tabela__principal">{e.razaoSocial}</span>
                      <span className="jn-tabela__sub jn-mono">
                        {formatarCnpj(e.cnpj)}
                        {!e.ativa ? ' · Desativada' : ''}
                        {encerrada ? ' · Vínculo encerrado (o histórico volta ao reabrir)' : ''}
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
                        aria-label={encerrada ? `Reabrir vínculo de ${e.razaoSocial}` : `Vincular ${e.razaoSocial}`}
                      >
                        {encerrada ? 'Reabrir vínculo' : 'Vincular'}
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
