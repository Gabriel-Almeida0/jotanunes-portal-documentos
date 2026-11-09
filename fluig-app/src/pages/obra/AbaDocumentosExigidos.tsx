import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ehSemPermissao, mensagemDeErro } from '../../api/client';
import { api } from '../../api/fluig';
import type { TipoDocumento, TipoExigidoObra } from '../../api/tipos';
import { useConsulta } from '../../api/useConsulta';
import { useEhAdmin } from '../../auth/contexto';
import { Alerta } from '../../components/Alerta';
import { Botao } from '../../components/Botao';
import { Carregando, EstadoErro, EstadoVazio } from '../../components/Estados';
import { FormularioTipo } from '../../components/FormularioTipo';
import { IconeMais } from '../../components/icons';
import { Selo, SeloAtivo } from '../../components/Selo';
import { ehPeriodico, textoPeriodicidade } from '../../utils/periodicidade';
import './AbaDocumentosExigidos.css';

interface Mensagem {
  tom: 'sucesso' | 'erro';
  texto: string;
}

/**
 * Aba "Documentos exigidos" do detalhe da obra (US1, FR-203): lista os tipos *por obra* e deixa o
 * administrador marcar/desmarcar quais esta obra exige. Cada mudança é salva na hora. O usuário
 * comum vê a mesma lista em modo leitura.
 */
export function AbaDocumentosExigidos({
  obraId,
  onAlterado,
  onSemPermissao,
}: {
  obraId: string;
  /** Chamado depois de marcar/desmarcar (para atualizar as contagens da obra). */
  onAlterado: () => void;
  onSemPermissao: (mensagem: string) => void;
}) {
  const consulta = useConsulta((sinal) => api.listarTiposExigidosObra(obraId, sinal), [obraId]);
  const ehAdmin = useEhAdmin();
  const [salvando, setSalvando] = useState<Set<string>>(new Set());
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const [criando, setCriando] = useState(false);

  const itens = consulta.dados ?? [];
  const exigidos = itens.filter((i) => i.exigido).length;

  async function alternar(item: TipoExigidoObra, exigir: boolean) {
    const tipo = item.tipoDocumento;
    setMensagem(null);
    setSalvando((s) => new Set(s).add(tipo.id));
    // Atualização otimista: a caixa muda na hora; volta se der erro.
    const atualizar = (exigido: boolean) =>
      consulta.definirDados(
        (consulta.dados ?? []).map((x) =>
          x.tipoDocumento.id === tipo.id ? { ...x, exigido, marcadoEm: exigido ? x.marcadoEm : null } : x,
        ),
      );
    atualizar(exigir);
    try {
      if (exigir) await api.marcarTipoExigidoObra(obraId, tipo.id);
      else await api.desmarcarTipoExigidoObra(obraId, tipo.id);
      setMensagem({
        tom: 'sucesso',
        texto: exigir
          ? `“${tipo.nome}” agora é exigido nesta obra. As empresas vinculadas veem o documento como “Pendente de envio”.`
          : `“${tipo.nome}” deixou de ser exigido nesta obra. Os envios já feitos continuam no histórico.`,
      });
      onAlterado();
    } catch (e) {
      atualizar(!exigir);
      if (ehSemPermissao(e)) onSemPermissao(e.title);
      else setMensagem({ tom: 'erro', texto: mensagemDeErro(e) });
    } finally {
      setSalvando((s) => {
        const novo = new Set(s);
        novo.delete(tipo.id);
        return novo;
      });
    }
  }

  /** Tipo criado pelo "Novo tipo por obra": já nasce exigido nesta obra. */
  async function aoCriar(tipo: TipoDocumento) {
    setCriando(false);
    setMensagem(null);
    try {
      await api.marcarTipoExigidoObra(obraId, tipo.id);
      setMensagem({
        tom: 'sucesso',
        texto: `“${tipo.nome}” foi cadastrado e já é exigido nesta obra. Ele também fica disponível para as outras obras.`,
      });
      onAlterado();
    } catch (e) {
      if (ehSemPermissao(e)) onSemPermissao(e.title);
      else
        setMensagem({
          tom: 'erro',
          texto: `“${tipo.nome}” foi cadastrado, mas não conseguimos marcá-lo nesta obra: ${mensagemDeErro(e)} Marque a caixa dele abaixo.`,
        });
    }
    consulta.recarregar();
  }

  return (
    <section aria-labelledby="jn-docs-exigidos-titulo">
      <div className="jn-secao__cabecalho">
        <div>
          <h2 className="jn-secao__titulo" id="jn-docs-exigidos-titulo">
            Documentos exigidos
          </h2>
          <p className="jn-secao__descricao">
            {ehAdmin
              ? 'Marque os documentos por obra que esta obra pede das empresas vinculadas. Cada mudança é salva na hora.'
              : 'Documentos por obra que esta obra pede das empresas vinculadas.'}
          </p>
        </div>
        {ehAdmin ? (
          <Botao variante="secundario" icone={<IconeMais />} onClick={() => setCriando(true)}>
            Novo tipo por obra
          </Botao>
        ) : null}
      </div>

      <div className="jn-avisos">
        <Alerta tom="info">
          Também são exigidos os documentos gerais da empresa. Eles valem em todas as obras e são configurados em{' '}
          <Link to="/tipos-documento?abrangencia=GERAL">Tipos de documento</Link>.
        </Alerta>
      </div>

      <div aria-live="polite">{mensagem ? <Alerta tom={mensagem.tom}>{mensagem.texto}</Alerta> : null}</div>

      {consulta.carregando && !consulta.dados ? (
        <Carregando texto="Carregando documentos da obra…" />
      ) : consulta.erro ? (
        <EstadoErro erro={consulta.erro} onTentarDeNovo={consulta.recarregar} />
      ) : itens.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum tipo de documento por obra cadastrado."
          texto={
            ehAdmin
              ? 'Cadastre um tipo com a abrangência “Por obra” (ex.: ART da obra) para escolher aqui o que esta obra exige.'
              : 'Quando um administrador cadastrar tipos por obra, eles aparecem aqui.'
          }
          acao={
            ehAdmin ? (
              <Botao variante="secundario" icone={<IconeMais />} onClick={() => setCriando(true)}>
                Novo tipo por obra
              </Botao>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="jn-texto-secundario jn-exigidos__contagem">
            {exigidos === 0
              ? 'Nenhum documento por obra exigido.'
              : exigidos === 1
                ? '1 documento por obra exigido.'
                : `${exigidos} documentos por obra exigidos.`}
          </p>
          <ul className="jn-exigidos" aria-label="Documentos por obra">
            {itens.map((item) => {
              const t = item.tipoDocumento;
              return (
                <li key={t.id} className="jn-exigidos__item">
                  {ehAdmin ? (
                    <label className="jn-caixa-marcacao jn-exigidos__marcacao">
                      <input
                        type="checkbox"
                        checked={item.exigido}
                        disabled={salvando.has(t.id)}
                        onChange={(e) => alternar(item, e.target.checked)}
                      />
                      <span className="jn-exigidos__nome">{t.nome}</span>
                    </label>
                  ) : (
                    <span className="jn-exigidos__nome">{t.nome}</span>
                  )}
                  <span className="jn-exigidos__selos">
                    {item.exigido ? <Selo tom="sucesso">Exigido</Selo> : <Selo tom="neutro">Não exigido</Selo>}
                    {!t.ativo ? <SeloAtivo ativo={false} /> : null}
                  </span>
                  {ehPeriodico(t.periodicidade) ? (
                    <span className="jn-tabela__sub jn-exigidos__instrucoes">
                      Periódico: {textoPeriodicidade(t.periodicidade)}
                    </span>
                  ) : null}
                  {t.instrucoes ? <span className="jn-tabela__sub jn-exigidos__instrucoes">{t.instrucoes}</span> : null}
                  {!t.ativo && item.exigido ? (
                    <span className="jn-tabela__sub jn-exigidos__instrucoes">
                      Tipo desativado: a marcação fica guardada e volta a valer quando o tipo for ativado.
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {criando ? (
        <FormularioTipo
          tipo={null}
          abrangenciaFixa="POR_OBRA"
          aviso="O tipo é criado com a abrangência “Por obra” e já fica exigido nesta obra. As outras obras podem marcá-lo depois."
          onFechar={() => setCriando(false)}
          onSalvo={(tipo) => void aoCriar(tipo)}
          onSemPermissao={(m) => {
            setCriando(false);
            onSemPermissao(m);
          }}
        />
      ) : null}
    </section>
  );
}
