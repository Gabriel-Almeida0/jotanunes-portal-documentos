import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ehSemPermissao, mensagemDeErro } from '../api/client';
import { api } from '../api/fluig';
import type { UsuarioInterno } from '../api/tipos';
import { useConsulta } from '../api/useConsulta';
import { useEhAdmin, useSessao, useUsuarioFluig } from '../auth/contexto';
import { AvisoPagina } from '../components/AvisoPagina';
import { AvisoSomenteAdmin } from '../components/AvisoSomenteAdmin';
import { Botao } from '../components/Botao';
import { Campo, CampoSelecao } from '../components/Campo';
import { Carregando, EstadoErro, EstadoVazio } from '../components/Estados';
import { Filtros } from '../components/Filtros';
import { FormularioUsuario } from '../components/FormularioUsuario';
import { IconeLapis, IconeMais, IconeUsuarios } from '../components/icons';
import { ModalConfirmacao } from '../components/Modal';
import { Paginacao } from '../components/Paginacao';
import { SeloSituacao } from '../components/Selo';
import { Tabela } from '../components/Tabela';
import { TituloPagina } from '../components/TituloPagina';
import { useAviso } from '../hooks/useAviso';
import { formatarDataHora, formatarHora } from '../utils/datas';
import './Usuarios.css';

const TAMANHO_PAGINA = 20;

type FiltroSituacao = 'todos' | 'ativos' | 'desativados';
type FiltroPerfil = 'todos' | 'administradores' | 'comuns';

interface FiltrosUsuarios {
  busca: string;
  situacao: FiltroSituacao;
  perfil: FiltroPerfil;
}

function lerFiltros(params: URLSearchParams): FiltrosUsuarios {
  const situacao = params.get('situacao');
  const perfil = params.get('perfil');
  return {
    busca: params.get('busca') ?? '',
    situacao: situacao === 'ativos' || situacao === 'desativados' ? situacao : 'todos',
    perfil: perfil === 'administradores' || perfil === 'comuns' ? perfil : 'todos',
  };
}

const DESCRICAO = 'Quem entra na área Jotanunes com login e senha próprios.';

/**
 * Tela "Usuários" (US9): gestão dos usuários internos do login próprio. Só administrador; o usuário
 * comum vê só o aviso e nenhuma chamada à API é feita (a API também recusa com 403).
 */
export function Usuarios() {
  if (!useEhAdmin()) {
    return (
      <>
        <TituloPagina titulo="Usuários" descricao={DESCRICAO} />
        <AvisoSomenteAdmin />
      </>
    );
  }
  return <GestaoUsuarios />;
}

function GestaoUsuarios() {
  const eu = useUsuarioFluig();
  const { sair } = useSessao();
  const [params, setParams] = useSearchParams();
  const filtros = lerFiltros(params);
  const pagina = Math.max(1, Number(params.get('pagina') ?? '1') || 1);
  const [rascunho, setRascunho] = useState<FiltrosUsuarios>(filtros);
  const [aviso, mostrarAviso] = useAviso();
  const [editando, setEditando] = useState<UsuarioInterno | 'novo' | null>(null);
  const [alternando, setAlternando] = useState<UsuarioInterno | null>(null);
  const [redefinindo, setRedefinindo] = useState<UsuarioInterno | null>(null);

  // Mantém o rascunho alinhado quando a URL muda por fora.
  const chaveUrl = params.toString();
  const [chaveAnterior, setChaveAnterior] = useState(chaveUrl);
  if (chaveUrl !== chaveAnterior) {
    setChaveAnterior(chaveUrl);
    setRascunho(filtros);
  }

  const consulta = useConsulta(
    (sinal) =>
      api.listarUsuarios(
        {
          busca: filtros.busca.trim() || undefined,
          ativo: filtros.situacao === 'todos' ? undefined : filtros.situacao === 'ativos',
          admin: filtros.perfil === 'todos' ? undefined : filtros.perfil === 'administradores',
          pagina,
          tamanhoPagina: TAMANHO_PAGINA,
        },
        sinal,
      ),
    [filtros.busca, filtros.situacao, filtros.perfil, pagina],
  );

  /** Linha do próprio usuário: só na sessão de login próprio (o login é o `sub` do token). */
  function ehProprio(u: UsuarioInterno): boolean {
    return eu.origem === 'LOGIN_LOCAL' && u.login === eu.login.toLowerCase();
  }

  function aplicar(novos: FiltrosUsuarios, novaPagina = 1) {
    const p = new URLSearchParams();
    if (novos.busca.trim()) p.set('busca', novos.busca.trim());
    if (novos.situacao !== 'todos') p.set('situacao', novos.situacao);
    if (novos.perfil !== 'todos') p.set('perfil', novos.perfil);
    if (novaPagina > 1) p.set('pagina', String(novaPagina));
    setParams(p);
  }

  const temFiltro = filtros.busca !== '' || filtros.situacao !== 'todos' || filtros.perfil !== 'todos';

  function limpar() {
    const vazio: FiltrosUsuarios = { busca: '', situacao: 'todos', perfil: 'todos' };
    setRascunho(vazio);
    aplicar(vazio);
  }

  function substituir(u: UsuarioInterno) {
    if (!consulta.dados) return;
    consulta.definirDados({ ...consulta.dados, itens: consulta.dados.itens.map((x) => (x.id === u.id ? u : x)) });
  }

  /** 403 SEM_PERMISSAO: fecha o que estiver aberto e mostra a mensagem, mantendo a lista. */
  function semPermissao(mensagem: string) {
    setEditando(null);
    setAlternando(null);
    setRedefinindo(null);
    mostrarAviso({ tom: 'erro', texto: mensagem });
  }

  const usuarios = consulta.dados?.itens ?? [];

  return (
    <>
      <TituloPagina
        titulo="Usuários"
        descricao={DESCRICAO}
        acoes={
          <Botao icone={<IconeMais tamanho={18} />} onClick={() => setEditando('novo')}>
            Novo usuário
          </Botao>
        }
      />

      <Filtros titulo="Encontre o usuário" onPesquisar={() => aplicar(rascunho)} onLimpar={temFiltro ? limpar : undefined}>
        <Campo
          rotulo="Buscar"
          placeholder="Nome, login ou e-mail"
          value={rascunho.busca}
          maxLength={100}
          onChange={(e) => setRascunho({ ...rascunho, busca: e.target.value })}
        />
        <CampoSelecao
          rotulo="Situação"
          value={rascunho.situacao}
          onChange={(e) => setRascunho({ ...rascunho, situacao: e.target.value as FiltroSituacao })}
        >
          <option value="todos">Todos</option>
          <option value="ativos">Ativos</option>
          <option value="desativados">Desativados</option>
        </CampoSelecao>
        <CampoSelecao
          rotulo="Perfil"
          value={rascunho.perfil}
          onChange={(e) => setRascunho({ ...rascunho, perfil: e.target.value as FiltroPerfil })}
        >
          <option value="todos">Todos</option>
          <option value="administradores">Administradores</option>
          <option value="comuns">Comuns</option>
        </CampoSelecao>
      </Filtros>

      <AvisoPagina aviso={aviso} onFechar={() => mostrarAviso(null)} />

      {consulta.carregando && !consulta.dados ? (
        <Carregando texto="Carregando usuários…" />
      ) : consulta.erro ? (
        <EstadoErro erro={consulta.erro} onTentarDeNovo={consulta.recarregar} />
      ) : usuarios.length === 0 ? (
        temFiltro ? (
          <EstadoVazio
            titulo="Nenhum usuário encontrado com esse filtro."
            acao={
              <Botao variante="secundario" onClick={limpar}>
                Limpar filtro
              </Botao>
            }
          />
        ) : (
          <EstadoVazio
            icone={<IconeUsuarios tamanho={32} />}
            titulo="Nenhum usuário com login próprio."
            texto="Cadastre quem precisa entrar com login e senha. A pessoa recebe a senha provisória por e-mail."
            acao={
              <Botao icone={<IconeMais tamanho={18} />} onClick={() => setEditando('novo')}>
                Novo usuário
              </Botao>
            }
          />
        )
      ) : (
        <>
          <Tabela rotulo="Usuários com login próprio" className="jn-usuarios__tabela">
            <thead>
              <tr>
                <th scope="col">Usuário</th>
                <th scope="col">Perfil</th>
                <th scope="col">Situação</th>
                <th scope="col">Último acesso</th>
                <th scope="col" className="jn-tabela__acoes">
                  <span className="jn-sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const proprio = ehProprio(u);
                return (
                  <tr key={u.id}>
                    <td>
                      <span className="jn-tabela__principal">{u.nome}</span>
                      {proprio ? <span className="jn-usuarios__voce">Você</span> : null}
                      <span className="jn-tabela__sub jn-usuarios__login">{u.login}</span>
                      <span className="jn-tabela__sub jn-usuarios__email">{u.email}</span>
                    </td>
                    <td className="jn-tabela__nowrap">{u.admin ? 'Administrador' : 'Comum'}</td>
                    <td>
                      <SeloSituacao situacao={u.situacao} />
                      {u.bloqueadoAte ? (
                        <span className="jn-tabela__sub">Login bloqueado até {formatarHora(u.bloqueadoAte)}</span>
                      ) : null}
                    </td>
                    <td className="jn-usuarios__acesso">
                      {u.ultimoAcessoEm ? formatarDataHora(u.ultimoAcessoEm) : 'Nunca entrou'}
                    </td>
                    <td className="jn-tabela__acoes">
                      <span className="jn-acoes-linha">
                        <Botao
                          variante="fantasma"
                          tamanho="pequeno"
                          icone={<IconeLapis tamanho={16} />}
                          onClick={() => setEditando(u)}
                          aria-label={`Editar ${u.nome}`}
                        >
                          Editar
                        </Botao>
                        {u.ativo ? (
                          <Botao
                            variante="fantasma"
                            tamanho="pequeno"
                            onClick={() => setRedefinindo(u)}
                            aria-label={`Redefinir senha de ${u.nome}`}
                          >
                            Redefinir senha
                          </Botao>
                        ) : null}
                        {proprio ? null : (
                          <Botao
                            variante="fantasma"
                            tamanho="pequeno"
                            onClick={() => setAlternando(u)}
                            aria-label={`${u.ativo ? 'Desativar' : 'Reativar'} ${u.nome}`}
                          >
                            {u.ativo ? 'Desativar' : 'Reativar'}
                          </Botao>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Tabela>
          <Paginacao
            pagina={pagina}
            tamanhoPagina={TAMANHO_PAGINA}
            total={consulta.dados?.total ?? 0}
            onMudar={(p) => aplicar(filtros, p)}
            rotuloItens="usuários"
          />
        </>
      )}

      {editando ? (
        <FormularioUsuario
          usuario={editando === 'novo' ? null : editando}
          proprio={editando !== 'novo' && ehProprio(editando)}
          onFechar={() => setEditando(null)}
          onSemPermissao={semPermissao}
          onSalvo={(u, novo) => {
            setEditando(null);
            mostrarAviso({
              tom: 'sucesso',
              texto: novo ? `Pronto. Enviamos a senha provisória para ${u.email}.` : `Alterações em "${u.nome}" salvas.`,
            });
            consulta.recarregar();
          }}
        />
      ) : null}

      <ConfirmarAtivacao
        usuario={alternando}
        onFechar={() => setAlternando(null)}
        onSemPermissao={semPermissao}
        onConcluido={(u) => {
          setAlternando(null);
          substituir(u);
          mostrarAviso({
            tom: 'sucesso',
            texto: u.ativo ? `"${u.nome}" voltou a ter acesso.` : `"${u.nome}" foi desativado e perdeu o acesso.`,
          });
        }}
      />

      <ConfirmarRedefinicao
        usuario={redefinindo}
        proprio={redefinindo ? ehProprio(redefinindo) : false}
        onFechar={() => setRedefinindo(null)}
        onSemPermissao={semPermissao}
        onConcluido={(u, proprio) => {
          setRedefinindo(null);
          if (proprio) {
            void sair('Sua senha foi redefinida. Entre com a senha provisória que chegou no seu e-mail.');
            return;
          }
          substituir(u);
          mostrarAviso({ tom: 'sucesso', texto: `Pronto. Enviamos a nova senha provisória para ${u.email}.` });
        }}
      />
    </>
  );
}

function ConfirmarAtivacao({
  usuario,
  onFechar,
  onConcluido,
  onSemPermissao,
}: {
  usuario: UsuarioInterno | null;
  onFechar: () => void;
  onConcluido: (u: UsuarioInterno) => void;
  onSemPermissao: (mensagem: string) => void;
}) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    if (!usuario) return;
    setCarregando(true);
    setErro(null);
    try {
      const atualizado = await api.atualizarUsuario(usuario.id, {
        nome: usuario.nome,
        email: usuario.email,
        admin: usuario.admin,
        ativo: !usuario.ativo,
      });
      onConcluido(atualizado);
    } catch (e) {
      if (ehSemPermissao(e)) onSemPermissao(e.title);
      else setErro(mensagemDeErro(e));
    } finally {
      setCarregando(false);
    }
  }

  const desativar = usuario?.ativo ?? true;
  return (
    <ModalConfirmacao
      aberto={Boolean(usuario)}
      titulo={desativar ? 'Desativar usuário?' : 'Reativar usuário?'}
      mensagem={
        desativar ? (
          <p>
            <strong>{usuario?.nome}</strong> ({usuario?.login}). A pessoa perde o acesso na hora. Continuar?
          </p>
        ) : (
          <p>
            <strong>{usuario?.nome}</strong> ({usuario?.login}) volta a entrar com a senha que já tinha.
          </p>
        )
      }
      rotuloConfirmar={desativar ? 'Desativar' : 'Reativar'}
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

function ConfirmarRedefinicao({
  usuario,
  proprio,
  onFechar,
  onConcluido,
  onSemPermissao,
}: {
  usuario: UsuarioInterno | null;
  proprio: boolean;
  onFechar: () => void;
  onConcluido: (u: UsuarioInterno, proprio: boolean) => void;
  onSemPermissao: (mensagem: string) => void;
}) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function confirmar() {
    if (!usuario) return;
    setCarregando(true);
    setErro(null);
    try {
      const atualizado = await api.redefinirSenhaUsuario(usuario.id);
      setCarregando(false);
      onConcluido(atualizado, proprio);
    } catch (e) {
      setCarregando(false);
      if (ehSemPermissao(e)) onSemPermissao(e.title);
      else setErro(mensagemDeErro(e));
    }
  }

  return (
    <ModalConfirmacao
      aberto={Boolean(usuario)}
      titulo="Redefinir senha?"
      mensagem={
        <>
          <p>
            <strong>{usuario?.nome}</strong> recebe por e-mail uma nova senha provisória. A senha atual e as sessões
            abertas deixam de valer. Continuar?
          </p>
          {proprio ? (
            <p className="jn-usuarios__alerta-proprio">
              É a sua própria senha. A sua sessão vai terminar e você volta para a tela de login.
            </p>
          ) : null}
        </>
      }
      rotuloConfirmar="Redefinir senha"
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
