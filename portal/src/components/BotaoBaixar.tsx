import { useState } from 'react';
import { api, ErroApi } from '../api/client';
import { MENSAGENS } from '../api/mensagens';
import type { EnvioPortal } from '../api/tipos';
import { Botao } from './Botao';
import { IconeBaixar } from './icons';

/** Nome do arquivo como link de download autenticado (Bearer → Blob), com erro inline. */
export function BotaoBaixar({ envio }: { envio: Pick<EnvioPortal, 'id' | 'nomeArquivo'> }) {
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function baixar() {
    setErro(null);
    setBaixando(true);
    try {
      await api.baixarArquivoEnvio(envio);
    } catch (e) {
      if (e instanceof ErroApi && e.code === 'NAO_AUTENTICADO') return;
      setErro(e instanceof ErroApi ? e.title : MENSAGENS.ERRO_INTERNO);
    } finally {
      setBaixando(false);
    }
  }

  return (
    <>
      <Botao
        variante="link"
        onClick={baixar}
        carregando={baixando}
        icone={<IconeBaixar tamanho={16} />}
        aria-label={`Baixar ${envio.nomeArquivo}`}
      >
        {envio.nomeArquivo}
      </Botao>
      {erro && (
        <span role="alert" className="jn-erro-inline">
          Não conseguimos baixar o arquivo. {erro}
        </span>
      )}
    </>
  );
}
