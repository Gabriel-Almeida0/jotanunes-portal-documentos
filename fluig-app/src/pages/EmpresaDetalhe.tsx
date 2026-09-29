import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErroApi, mensagemDeErro } from '../api/client';
import { api } from '../api/fluig';
import type { Empresa } from '../api/tipos';
import { useConsulta } from '../api/useConsulta';
import { Alerta } from '../components/Alerta';
import { AvisoPagina } from '../components/AvisoPagina';
import { Botao } from '../components/Botao';
import { Carregando, EstadoErro } from '../components/Estados';
import { CamposEmpresa } from '../components/FormularioEmpresa';
import { useFormularioEmpresa } from '../hooks/useFormularioEmpresa';
import { IconePin } from '../components/icons';
import { ModalConfirmacao } from '../components/Modal';
import { SeloSituacao } from '../components/Selo';
import { TituloPagina } from '../components/TituloPagina';
import { useAviso } from '../hooks/useAviso';
import { formatarCnpj } from '../utils/cnpj';
import { formatarData } from '../utils/datas';
import { SecaoAcessoPortal } from './empresa/SecaoAcessoPortal';
import { SecaoDocumentos } from './empresa/SecaoDocumentos';
import './EmpresaDetalhe.css';

export function EmpresaDetalhe() {
  const { empresaId = '' } = useParams();
  const consulta = useConsulta((sinal) => api.obterEmpresa(empresaId, sinal), [empresaId]);
  const [aviso, mostrarAviso] = useAviso();
  const [alternando, setAlternando] = useState(false);

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

  return (
    <>
      <TituloPagina
        titulo={empresa.razaoSocial}
        voltar={{ para: '/empresas', rotulo: 'Empresas' }}
        acoes={
          <Botao variante="fantasma" onClick={() => setAlternando(true)}>
            {empresa.ativa ? 'Desativar empresa' : 'Ativar empresa'}
          </Botao>
        }
      >
        <span className="jn-meta jn-mono">CNPJ {formatarCnpj(empresa.cnpj)}</span>
        <SeloSituacao situacao={empresa.situacaoAcesso} />
        <span className="jn-meta">Cadastrada em {formatarData(empresa.criadoEm)}</span>
      </TituloPagina>

      <AvisoPagina aviso={aviso} onFechar={() => mostrarAviso(null)} />

      <div className="jn-grade-detalhe">
        <DadosEmpresa
          key={`${empresa.id}-${empresa.cnpjEditavel}`}
          empresa={empresa}
          onSalva={(salva) => {
            consulta.definirDados(salva);
            mostrarAviso({ tom: 'sucesso', texto: 'Dados da empresa salvos.' });
          }}
        />
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

function DadosEmpresa({ empresa, onSalva }: { empresa: Empresa; onSalva: (e: Empresa) => void }) {
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
      form.tratarErro(erro);
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
}: {
  empresa: Empresa | null;
  onFechar: () => void;
  onConcluido: (e: Empresa) => void;
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
      setErro(mensagemDeErro(e));
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
