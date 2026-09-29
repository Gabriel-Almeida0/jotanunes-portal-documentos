import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ErroApi, mensagemDeErro } from '../api/client';
import { api } from '../api/fluig';
import type { TipoDocumento } from '../api/tipos';
import { useConsulta } from '../api/useConsulta';
import { Alerta } from '../components/Alerta';
import { AvisoPagina } from '../components/AvisoPagina';
import { Botao } from '../components/Botao';
import { Campo, CampoArea, CampoSelecao } from '../components/Campo';
import { Carregando, EstadoErro, EstadoVazio } from '../components/Estados';
import { Filtros } from '../components/Filtros';
import { IconeLapis, IconeMais } from '../components/icons';
import { Modal, ModalConfirmacao } from '../components/Modal';
import { SeloAtivo } from '../components/Selo';
import { Tabela } from '../components/Tabela';
import { TituloPagina } from '../components/TituloPagina';
import { useAviso } from '../hooks/useAviso';
import { formatarData } from '../utils/datas';
import './TiposDocumento.css';

type FiltroSituacao = 'todos' | 'ativos' | 'inativos';

const LIMITE_INSTRUCOES = 1000;

function resumir(texto: string | null | undefined, max = 110): string {
  if (!texto) return '';
  return texto.length > max ? `${texto.slice(0, max - 1).trimEnd()}…` : texto;
}

export function TiposDocumento() {
  const [params, setParams] = useSearchParams();
  const situacao = (params.get('situacao') as FiltroSituacao | null) ?? 'todos';
  const [rascunho, setRascunho] = useState<FiltroSituacao>(situacao);
  const [aviso, mostrarAviso] = useAviso();
  const [editando, setEditando] = useState<TipoDocumento | 'novo' | null>(null);
  const [alternando, setAlternando] = useState<TipoDocumento | null>(null);

  const ativo = situacao === 'ativos' ? true : situacao === 'inativos' ? false : undefined;
  const consulta = useConsulta((sinal) => api.listarTipos({ ativo }, sinal), [ativo]);

  function pesquisar() {
    const novo = new URLSearchParams(params);
    if (rascunho === 'todos') novo.delete('situacao');
    else novo.set('situacao', rascunho);
    setParams(novo);
  }

  function limpar() {
    setRascunho('todos');
    setParams(new URLSearchParams());
  }

  function aoSalvar(tipo: TipoDocumento, novo: boolean) {
    setEditando(null);
    mostrarAviso({
      tom: 'sucesso',
      texto: novo
        ? 'Tipo de documento cadastrado. Ele já passa a ser exigido de todas as empresas ativas.'
        : `Alterações em "${tipo.nome}" salvas.`,
    });
    consulta.recarregar();
  }

  const tipos = consulta.dados ?? [];

  return (
    <>
      <TituloPagina
        titulo="Tipos de documento"
        descricao="Os documentos que a Jotanunes exige. Todo tipo ativo é pedido de todas as empresas ativas."
        acoes={
          <Botao icone={<IconeMais tamanho={18} />} onClick={() => setEditando('novo')}>
            Novo tipo de documento
          </Botao>
        }
      />

      <Filtros titulo="Encontre o documento" onPesquisar={pesquisar} onLimpar={situacao !== 'todos' ? limpar : undefined}>
        <CampoSelecao
          rotulo="Situação"
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value as FiltroSituacao)}
        >
          <option value="todos">Todos</option>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
        </CampoSelecao>
      </Filtros>

      <AvisoPagina aviso={aviso} onFechar={() => mostrarAviso(null)} />

      {consulta.carregando && !consulta.dados ? (
        <Carregando texto="Carregando tipos de documento…" />
      ) : consulta.erro ? (
        <EstadoErro erro={consulta.erro} onTentarDeNovo={consulta.recarregar} />
      ) : tipos.length === 0 ? (
        situacao === 'todos' ? (
          <EstadoVazio
            titulo="Nenhum tipo de documento cadastrado."
            texto="Cadastre os documentos que as empresas precisam enviar, como Cartão CNPJ ou ASO."
            acao={
              <Botao icone={<IconeMais tamanho={18} />} onClick={() => setEditando('novo')}>
                Novo tipo de documento
              </Botao>
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
              <th scope="col">Situação</th>
              <th scope="col">Cadastrado em</th>
              <th scope="col" className="jn-tabela__acoes">
                <span className="jn-sr-only">Ações</span>
              </th>
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
                  <SeloAtivo ativo={t.ativo} />
                </td>
                <td className="jn-tabela__nowrap">{formatarData(t.criadoEm)}</td>
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
        />
      ) : null}

      <ConfirmarAlternancia
        tipo={alternando}
        onFechar={() => setAlternando(null)}
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

function FormularioTipo({
  tipo,
  onFechar,
  onSalvo,
}: {
  tipo: TipoDocumento | null;
  onFechar: () => void;
  onSalvo: (tipo: TipoDocumento, novo: boolean) => void;
}) {
  const [nome, setNome] = useState(tipo?.nome ?? '');
  const [instrucoes, setInstrucoes] = useState(tipo?.instrucoes ?? '');
  const [erros, setErros] = useState<Record<string, string | undefined>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const nomeLimpo = nome.trim();
    const novosErros: Record<string, string> = {};
    if (nomeLimpo.length < 3 || nomeLimpo.length > 120) novosErros.nome = 'Informe o nome (de 3 a 120 caracteres).';
    if (instrucoes.length > LIMITE_INSTRUCOES) novosErros.instrucoes = 'As instruções podem ter até 1000 caracteres.';
    setErros(novosErros);
    setErroGeral(null);
    if (Object.keys(novosErros).length) return;

    setSalvando(true);
    try {
      const dados = { nome: nomeLimpo, instrucoes: instrucoes.trim() || null };
      const salvo = tipo ? await api.atualizarTipo(tipo.id, { ...dados, ativo: tipo.ativo }) : await api.criarTipo(dados);
      onSalvo(salvo, !tipo);
    } catch (erro) {
      if (erro instanceof ErroApi && erro.code === 'NOME_DUPLICADO') {
        setErros({ nome: erro.title });
      } else if (erro instanceof ErroApi && erro.code === 'VALIDACAO') {
        setErros({ nome: erro.erroDoCampo('nome'), instrucoes: erro.erroDoCampo('instrucoes') });
        setErroGeral(erro.title);
      } else {
        setErroGeral(mensagemDeErro(erro));
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto
      titulo={tipo ? 'Editar tipo de documento' : 'Novo tipo de documento'}
      onFechar={onFechar}
      bloqueado={salvando}
      rodape={
        <>
          <Botao variante="secundario" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao type="submit" form="jn-form-tipo" carregando={salvando} textoCarregando="Salvando…">
            Salvar
          </Botao>
        </>
      }
    >
      <form id="jn-form-tipo" className="jn-pilha" onSubmit={salvar} noValidate>
        {erroGeral ? <Alerta tom="erro">{erroGeral}</Alerta> : null}
        <Campo
          rotulo="Nome"
          obrigatorio
          maxLength={120}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          erro={erros.nome}
          placeholder="Ex.: Cartão CNPJ"
          complemento={`${nome.length}/120`}
        />
        <CampoArea
          rotulo="Instruções para a empresa"
          value={instrucoes}
          onChange={(e) => setInstrucoes(e.target.value)}
          erro={erros.instrucoes}
          maxLength={LIMITE_INSTRUCOES}
          ajuda="Aparece para a empresa junto do documento. Diga o que enviar e como."
          complemento={`${instrucoes.length}/${LIMITE_INSTRUCOES}`}
          rows={5}
        />
      </form>
    </Modal>
  );
}

function ConfirmarAlternancia({
  tipo,
  onFechar,
  onConcluido,
}: {
  tipo: TipoDocumento | null;
  onFechar: () => void;
  onConcluido: (tipo: TipoDocumento) => void;
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
        ativo: !tipo.ativo,
      });
      onConcluido(atualizado);
    } catch (e) {
      setErro(mensagemDeErro(e));
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
            <strong>{tipo?.nome}</strong>. Este tipo deixa de ser exigido das empresas. Os envios já feitos continuam
            no histórico.
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
