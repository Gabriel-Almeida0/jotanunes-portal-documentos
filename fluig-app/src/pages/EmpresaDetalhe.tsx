import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErroApi, ehSemPermissao, mensagemDeErro } from '../api/client';
import { api } from '../api/fluig';
import type { Empresa } from '../api/tipos';
import { useConsulta } from '../api/useConsulta';
import { useEhAdmin } from '../auth/contexto';
import { Alerta } from '../components/Alerta';
import { AvisoPagina } from '../components/AvisoPagina';
import { AvisoSomenteAdmin } from '../components/AvisoSomenteAdmin';
import { Botao } from '../components/Botao';
import { Carregando, EstadoErro } from '../components/Estados';
import { CamposEmpresa } from '../components/FormularioEmpresa';
import { useFormularioEmpresa } from '../hooks/useFormularioEmpresa';
import { IconePin } from '../components/icons';
import { ModalConfirmacao } from '../components/Modal';
import { SeloSituacao } from '../components/Selo';
import { SomenteAdmin } from '../components/SomenteAdmin';
import { TituloPagina } from '../components/TituloPagina';
import { useAviso } from '../hooks/useAviso';
import { formatarCnpj } from '../utils/cnpj';
import { formatarData } from '../utils/datas';
import { formatarTelefone } from '../utils/formatos';
import { SecaoAcessoPortal } from './empresa/SecaoAcessoPortal';
import { SecaoDocumentos } from './empresa/SecaoDocumentos';
import './EmpresaDetalhe.css';

export function EmpresaDetalhe() {
  const { empresaId = '' } = useParams();
  const consulta = useConsulta((sinal) => api.obterEmpresa(empresaId, sinal), [empresaId]);
  const [aviso, mostrarAviso] = useAviso();
  const [alternando, setAlternando] = useState(false);
  const ehAdmin = useEhAdmin();

  if (consulta.carregando && !consulta.dados) return <Carregando texto="Carregando empresa…" />;
  if (consulta.erro || !consulta.dados) {
    const naoEncontrada = consulta.erro instanceof ErroApi && consulta.erro.status === 404;
    return (
      <>
        <TituloPagina titulo="Empresa" voltar={{ para: '/empresas', rotulo: 'Empresas' }} />
        <EstadoErro erro={consulta.erro} onTentarDeNovo={naoEncontrada ? undefined : consulta.recarregar} />
      </>
    );
  }

  const empresa = consulta.dados;

  /** 403 SEM_PERMISSAO: fecha o modal e mostra a mensagem, mantendo os dados da empresa. */
  function semPermissao(mensagem: string) {
    setAlternando(false);
    mostrarAviso({ tom: 'erro', texto: mensagem });
  }

  return (
    <>
      <TituloPagina
        titulo={empresa.razaoSocial}
        voltar={{ para: '/empresas', rotulo: 'Empresas' }}
        acoes={
          <SomenteAdmin>
            <Botao variante="fantasma" onClick={() => setAlternando(true)}>
              {empresa.ativa ? 'Desativar empresa' : 'Ativar empresa'}
            </Botao>
          </SomenteAdmin>
        }
      >
        <span className="jn-meta jn-mono">CNPJ {formatarCnpj(empresa.cnpj)}</span>
        <SeloSituacao situacao={empresa.situacaoAcesso} />
        <span className="jn-meta">Cadastrada em {formatarData(empresa.criadoEm)}</span>
      </TituloPagina>

      <AvisoSomenteAdmin />

      <AvisoPagina aviso={aviso} onFechar={() => mostrarAviso(null)} />

      <div className="jn-grade-detalhe">
        {ehAdmin ? (
          <DadosEmpresa
            key={`${empresa.id}-${empresa.cnpjEditavel}`}
            empresa={empresa}
            onSemPermissao={semPermissao}
            onSalva={(salva) => {
              consulta.definirDados(salva);
              mostrarAviso({ tom: 'sucesso', texto: 'Dados da empresa salvos.' });
            }}
          />
        ) : (
          <DadosEmpresaLeitura empresa={empresa} />
        )}
        <div className="jn-pilha jn-empresa__lateral">
          <SecaoAcessoPortal empresa={empresa} onAlterada={consulta.recarregar} />
          <section className="jn-painel-bloco" aria-labelledby="jn-obras-empresa">
            <div className="jn-painel-bloco__cabecalho">
              <h2 className="jn-painel-bloco__titulo" id="jn-obras-empresa">
                Obras
              </h2>
            </div>
            {empresa.obras.length === 0 ? (
              <p className="jn-texto-secundario">
                Esta empresa ainda não está em nenhuma obra. Vincule pela página da <Link to="/obras">obra</Link>.
              </p>
            ) : (
              <ul className="jn-lista-simples" aria-label="Obras da empresa">
                {empresa.obras.map((o) => (
                  <li key={o.id}>
                    <Link to={`/obras/${o.id}`}>{o.nome}</Link>
                    <span className="jn-meta jn-local">
                      <IconePin tamanho={16} /> {o.cidade}/{o.uf}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <SecaoDocumentos empresaId={empresa.id} />

      <AlternarEmpresa
        empresa={alternando ? empresa : null}
        onFechar={() => setAlternando(false)}
        onSemPermissao={semPermissao}
        onConcluido={(salva) => {
          setAlternando(false);
          consulta.definirDados(salva);
          mostrarAviso({
            tom: 'sucesso',
            texto: salva.ativa ? 'Empresa ativada.' : 'Empresa desativada. O acesso ao portal foi bloqueado.',
          });
        }}
      />
    </>
  );
}

/** Dados da empresa para o usuário comum: só leitura, sem formulário (FR-084). */
function DadosEmpresaLeitura({ empresa }: { empresa: Empresa }) {
  const naoInformado = <span className="jn-texto-secundario">Não informado</span>;
  return (
    <section className="jn-painel-bloco" aria-labelledby="jn-dados-empresa">
      <div className="jn-painel-bloco__cabecalho">
        <h2 className="jn-painel-bloco__titulo" id="jn-dados-empresa">
          Dados da empresa
        </h2>
      </div>
      <dl className="jn-dados">
        <dt>Razão social</dt>
        <dd>{empresa.razaoSocial}</dd>
        <dt>Nome fantasia</dt>
        <dd>{empresa.nomeFantasia || naoInformado}</dd>
        <dt>CNPJ</dt>
        <dd className="jn-mono">{formatarCnpj(empresa.cnpj)}</dd>
        <dt>E-mail de contato</dt>
        <dd>{empresa.emailContato}</dd>
        <dt>Nome do contato</dt>
        <dd>{empresa.nomeContato || naoInformado}</dd>
        <dt>Telefone</dt>
        <dd>{empresa.telefone ? formatarTelefone(empresa.telefone) : naoInformado}</dd>
      </dl>
    </section>
  );
}

function DadosEmpresa({
  empresa,
  onSalva,
  onSemPermissao,
}: {
  empresa: Empresa;
  onSalva: (e: Empresa) => void;
  onSemPermissao: (mensagem: string) => void;
}) {
  const form = useFormularioEmpresa(empresa);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const dados = form.validar();
    if (!dados) return;
    setSalvando(true);
    try {
      const salva = await api.atualizarEmpresa(empresa.id, { ...dados, ativa: empresa.ativa });
      form.redefinir(salva);
      onSalva(salva);
    } catch (erro) {
      if (ehSemPermissao(erro)) onSemPermissao(erro.title);
      else form.tratarErro(erro);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="jn-painel-bloco" aria-labelledby="jn-dados-empresa">
      <div className="jn-painel-bloco__cabecalho">
        <h2 className="jn-painel-bloco__titulo" id="jn-dados-empresa">
          Dados da empresa
        </h2>
      </div>
      <form className="jn-grade-form" onSubmit={salvar} noValidate aria-labelledby="jn-dados-empresa">
        {form.erroGeral ? (
          <div className="jn-grade-form__inteiro">
            <Alerta tom="erro">{form.erroGeral}</Alerta>
          </div>
        ) : null}
        <CamposEmpresa form={form} cnpjBloqueado={!empresa.cnpjEditavel} />
        <div className="jn-grade-form__inteiro jn-rodape-form">
          <Botao variante="secundario" onClick={() => form.redefinir(empresa)} disabled={salvando}>
            Descartar alterações
          </Botao>
          <Botao type="submit" carregando={salvando} textoCarregando="Salvando…">
            Salvar alterações
          </Botao>
        </div>
      </form>
    </section>
  );
}

function AlternarEmpresa({
  empresa,
  onFechar,
  onConcluido,
  onSemPermissao,
}: {
  empresa: Empresa | null;
  onFechar: () => void;
  onConcluido: (e: Empresa) => void;
  onSemPermissao: (mensagem: string) => void;
}) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const desativar = empresa?.ativa ?? true;

  async function confirmar() {
    if (!empresa) return;
    setCarregando(true);
    setErro(null);
    try {
      const salva = await api.atualizarEmpresa(empresa.id, {
        razaoSocial: empresa.razaoSocial,
        nomeFantasia: empresa.nomeFantasia ?? null,
        cnpj: empresa.cnpj,
        emailContato: empresa.emailContato,
        nomeContato: empresa.nomeContato ?? null,
        telefone: empresa.telefone ?? null,
        ativa: !empresa.ativa,
      });
      onConcluido(salva);
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
      titulo={desativar ? 'Desativar empresa?' : 'Ativar empresa?'}
      mensagem={
        desativar
          ? 'A empresa perde o acesso ao portal na hora e deixa de receber pedidos de documentos. O histórico continua guardado.'
          : 'A empresa volta a acessar o portal com a senha que já tem e os documentos voltam a ser exigidos.'
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
