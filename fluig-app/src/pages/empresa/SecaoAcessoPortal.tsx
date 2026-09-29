import { useState } from 'react';
import { mensagemDeErro } from '../../api/client';
import { api } from '../../api/fluig';
import type { Empresa, SituacaoAcesso } from '../../api/tipos';
import { useConsulta } from '../../api/useConsulta';
import { useEhAdmin } from '../../auth/contexto';
import { Alerta } from '../../components/Alerta';
import { Botao } from '../../components/Botao';
import { Carregando, EstadoErro } from '../../components/Estados';
import { IconeEmail } from '../../components/icons';
import { ModalConfirmacao } from '../../components/Modal';
import { SeloSituacao } from '../../components/Selo';
import { formatarDataHora } from '../../utils/datas';

const EXPLICACAO: Record<SituacaoAcesso, string> = {
  NAO_CONVIDADA: 'A empresa ainda não recebeu o convite para o portal.',
  CONVIDADA: 'Convite enviado. A empresa ainda não fez o primeiro acesso.',
  CONVITE_EXPIRADO: 'O convite venceu sem o primeiro acesso. Reenvie para gerar um novo link e uma nova senha.',
  ATIVA: 'A empresa já acessa o portal e envia os documentos por lá.',
  DESATIVADA: 'Empresa desativada: o acesso ao portal está bloqueado.',
};

/** Seção "Acesso ao portal": situação, último convite, enviar/reenviar e histórico (US2). */
export function SecaoAcessoPortal({ empresa, onAlterada }: { empresa: Empresa; onAlterada: () => void }) {
  const [enviando, setEnviando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<{ tom: 'sucesso' | 'erro'; texto: string } | null>(null);
  const [versao, setVersao] = useState(0);
  const ehAdmin = useEhAdmin();
  const convites = useConsulta((sinal) => api.listarConvites(empresa.id, sinal), [empresa.id, versao]);

  const ultimo = empresa.ultimoConvite ?? null;
  const reenvio = Boolean(ultimo);

  async function enviar() {
    setEnviando(true);
    setResultado(null);
    try {
      const convite = await api.enviarConvite(empresa.id);
      setConfirmando(false);
      setResultado({ tom: 'sucesso', texto: `Convite enviado para ${convite.emailDestino}.` });
      setVersao((v) => v + 1);
      onAlterada();
    } catch (erro) {
      setConfirmando(false);
      setResultado({ tom: 'erro', texto: mensagemDeErro(erro) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="jn-painel-bloco jn-painel-bloco--assinatura jn-acesso" aria-labelledby="jn-acesso-titulo">
      <div className="jn-painel-bloco__cabecalho">
        <h2 className="jn-painel-bloco__titulo" id="jn-acesso-titulo">
          Acesso ao portal
        </h2>
        <SeloSituacao situacao={empresa.situacaoAcesso} />
      </div>
      <p className="jn-acesso__explicacao">{EXPLICACAO[empresa.situacaoAcesso]}</p>

      <dl className="jn-dados jn-acesso__dados">
        <dt>Último convite</dt>
        <dd>
          {ultimo ? (
            <>
              {formatarDataHora(ultimo.enviadoEm)}
              <span className="jn-tabela__sub">por {ultimo.enviadoPor.nome}</span>
            </>
          ) : (
            'Nunca enviado'
          )}
        </dd>
        {ultimo ? (
          <>
            <dt>Enviado para</dt>
            <dd>{ultimo.emailDestino}</dd>
            <dt>{ultimo.usadoEm ? 'Primeiro acesso' : 'Link vale até'}</dt>
            <dd>{formatarDataHora(ultimo.usadoEm ?? ultimo.expiraEm)}</dd>
            <dt>Situação do convite</dt>
            <dd>
              <SeloSituacao situacao={ultimo.situacao} />
            </dd>
          </>
        ) : null}
        <dt>Último acesso</dt>
        <dd>{empresa.ultimoAcessoEm ? formatarDataHora(empresa.ultimoAcessoEm) : 'Ainda não acessou'}</dd>
      </dl>

      {resultado ? (
        <div className="jn-acesso__resultado">
          <Alerta tom={resultado.tom} onFechar={() => setResultado(null)}>
            {resultado.texto}
          </Alerta>
        </div>
      ) : null}

      <div className="jn-acesso__acoes">
        <Botao
          icone={<IconeEmail tamanho={18} />}
          variante={reenvio ? 'secundario' : 'primario'}
          disabled={!empresa.ativa}
          carregando={enviando && !confirmando}
          textoCarregando="Enviando convite…"
          onClick={() => (reenvio ? setConfirmando(true) : enviar())}
        >
          {reenvio ? 'Reenviar convite' : 'Enviar convite'}
        </Botao>
        {!empresa.ativa ? (
          <p className="jn-acesso__nota">
            {ehAdmin
              ? 'Ative a empresa para enviar o convite.'
              : 'Empresa desativada. Um administrador precisa ativá-la antes do convite.'}
          </p>
        ) : (
          <p className="jn-acesso__nota">
            O e-mail leva o link do portal e uma senha temporária, que vale por 7 dias. A senha não aparece aqui.
          </p>
        )}
      </div>

      <details className="jn-acesso__historico">
        <summary>
          Histórico de convites{convites.dados ? ` (${convites.dados.length})` : ''}
        </summary>
        {convites.carregando && !convites.dados ? (
          <Carregando texto="Carregando convites…" />
        ) : convites.erro ? (
          <EstadoErro erro={convites.erro} onTentarDeNovo={convites.recarregar} />
        ) : (convites.dados ?? []).length === 0 ? (
          <p className="jn-texto-secundario">Nenhum convite enviado.</p>
        ) : (
          <ul className="jn-lista-simples" aria-label="Convites enviados">
            {(convites.dados ?? []).map((c) => (
              <li key={c.id}>
                <div>
                  <span className="jn-tabela__principal">{formatarDataHora(c.enviadoEm)}</span>
                  <span className="jn-tabela__sub">
                    por {c.enviadoPor.nome} · para {c.emailDestino}
                  </span>
                </div>
                <SeloSituacao situacao={c.situacao} />
              </li>
            ))}
          </ul>
        )}
      </details>

      <ModalConfirmacao
        aberto={confirmando}
        titulo="Reenviar convite?"
        mensagem={
          <p>
            A senha e o link anteriores deixam de valer. Continuar?
            <br />
            <span className="jn-texto-secundario">
              Um novo e-mail vai para {empresa.emailContato} e a empresa precisa criar uma nova senha no próximo
              acesso.
            </span>
          </p>
        }
        rotuloConfirmar="Reenviar convite"
        carregando={enviando}
        onConfirmar={enviar}
        onCancelar={() => setConfirmando(false)}
      />
    </section>
  );
}
