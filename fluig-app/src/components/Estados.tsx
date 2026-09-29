import type { ReactNode } from 'react';
import { mensagemDeErro } from '../api/client';
import { Botao } from './Botao';
import { IconeAlerta, IconeDocumento, IconeRecarregar } from './icons';
import './Estados.css';

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="jn-estado jn-estado--carregando" role="status" aria-live="polite">
      <span className="jn-estado__giro" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}

export interface EstadoVazioProps {
  titulo: string;
  texto?: ReactNode;
  acao?: ReactNode;
  icone?: ReactNode;
}

export function EstadoVazio({ titulo, texto, acao, icone }: EstadoVazioProps) {
  return (
    <div className="jn-estado jn-estado--vazio">
      <span className="jn-estado__icone" aria-hidden="true">
        {icone ?? <IconeDocumento tamanho={32} />}
      </span>
      <p className="jn-estado__titulo">{titulo}</p>
      {texto ? <p className="jn-estado__texto">{texto}</p> : null}
      {acao ? <div className="jn-estado__acao">{acao}</div> : null}
    </div>
  );
}

export function EstadoErro({ erro, onTentarDeNovo }: { erro: unknown; onTentarDeNovo?: () => void }) {
  return (
    <div className="jn-estado jn-estado--erro" role="alert">
      <span className="jn-estado__icone" aria-hidden="true">
        <IconeAlerta tamanho={32} />
      </span>
      <p className="jn-estado__titulo">{mensagemDeErro(erro)}</p>
      {onTentarDeNovo ? (
        <div className="jn-estado__acao">
          <Botao variante="secundario" icone={<IconeRecarregar tamanho={18} />} onClick={onTentarDeNovo}>
            Tentar de novo
          </Botao>
        </div>
      ) : null}
    </div>
  );
}
