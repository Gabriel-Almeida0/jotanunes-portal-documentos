import { useId, useRef, useState, type ChangeEvent } from 'react';
import { api, ErroApi } from '../api/client';
import { MENSAGENS } from '../api/mensagens';
import type { EnvioPortal } from '../api/tipos';
import { ACCEPT, validarArquivo } from '../utils/arquivo';
import { formatarTamanho } from '../utils/datas';
import { Alerta } from './Alerta';
import { Botao } from './Botao';
import { IconeArquivo, IconeEnviar } from './icons';
import './EnvioArquivo.css';

interface Props {
  tipoDocumento: { id: string; nome: string };
  /** "Enviar documento" (pendente) ou "Enviar novo arquivo" (rejeitado). */
  rotulo?: string;
  aoEnviar: (envio: EnvioPortal) => void;
  /** Chamado quando o servidor diz que a situação mudou (ex.: 409) — recarregar a lista. */
  aoDesatualizar?: () => void;
}

/**
 * Escolha e envio de um arquivo (PDF, JPG ou PNG até 10 MB). A pessoa confere o arquivo antes de
 * confirmar, porque depois do envio ele fica em análise e não pode ser trocado.
 */
export function EnvioArquivo({
  tipoDocumento,
  rotulo = 'Enviar documento',
  aoEnviar,
  aoDesatualizar,
}: Props) {
  const idBase = useId();
  const refInput = useRef<HTMLInputElement>(null);
  const refConfirmar = useRef<HTMLButtonElement>(null);
  const refEscolher = useRef<HTMLButtonElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const idDica = `${idBase}-dica`;

  async function aoEscolher(evento: ChangeEvent<HTMLInputElement>) {
    const escolhido = evento.target.files?.[0] ?? null;
    evento.target.value = '';
    if (!escolhido) return;
    setErro(null);
    setConferindo(true);
    const problema = await validarArquivo(escolhido);
    setConferindo(false);
    if (problema) {
      setArquivo(null);
      setErro(problema);
      return;
    }
    setArquivo(escolhido);
    requestAnimationFrame(() => refConfirmar.current?.focus());
  }

  function cancelar() {
    setArquivo(null);
    setErro(null);
    requestAnimationFrame(() => refEscolher.current?.focus());
  }

  async function enviar() {
    if (!arquivo) return;
    setErro(null);
    setEnviando(true);
    try {
      const envio = await api.enviarDocumento(tipoDocumento.id, arquivo);
      setArquivo(null);
      setEnviando(false);
      aoEnviar(envio);
    } catch (e) {
      setEnviando(false);
      if (!(e instanceof ErroApi)) return setErro(MENSAGENS.ERRO_INTERNO);
      // 401: o cliente já levou para o login com o aviso de sessão expirada.
      if (e.code === 'NAO_AUTENTICADO' || e.code === 'TROCA_SENHA_OBRIGATORIA') return;
      setErro(e.erroDoCampo('arquivo') ?? e.title);
      if (e.code === 'ENVIO_NAO_PERMITIDO' || e.code === 'NAO_ENCONTRADO') {
        setArquivo(null);
        aoDesatualizar?.();
      }
    }
  }

  return (
    <div className="jn-envio">
      <input
        ref={refInput}
        type="file"
        accept={ACCEPT}
        className="jn-visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        aria-label={`Arquivo para ${tipoDocumento.nome}`}
        onChange={aoEscolher}
      />

      {arquivo ? (
        <div className="jn-envio__conferir">
          <p className="jn-envio__arquivo">
            <IconeArquivo />
            <span>
              <span className="jn-envio__nome">{arquivo.name}</span>
              <span className="jn-envio__tamanho">{formatarTamanho(arquivo.size)}</span>
            </span>
          </p>
          <p className="jn-envio__aviso">
            Confira antes de enviar: depois de enviado, o arquivo fica em análise e não pode ser
            trocado.
          </p>
          <div className="jn-envio__acoes">
            <Botao
              ref={refConfirmar}
              icone={<IconeEnviar tamanho={18} />}
              carregando={enviando}
              textoCarregando="Enviando…"
              onClick={enviar}
            >
              Enviar arquivo
            </Botao>
            <Botao variante="secundario" onClick={cancelar} disabled={enviando}>
              Cancelar
            </Botao>
          </div>
        </div>
      ) : (
        <div className="jn-envio__escolher">
          <Botao
            ref={refEscolher}
            icone={<IconeEnviar tamanho={18} />}
            onClick={() => refInput.current?.click()}
            carregando={conferindo}
            textoCarregando="Conferindo arquivo…"
            aria-describedby={idDica}
          >
            {rotulo}
          </Botao>
          <span className="jn-envio__dica" id={idDica}>
            PDF, JPG ou PNG, até 10 MB.
          </span>
        </div>
      )}

      {erro && <Alerta tipo="erro" titulo={erro} className="jn-envio__erro" />}
    </div>
  );
}
