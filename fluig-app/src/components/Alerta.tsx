import type { ReactNode } from 'react';
import { IconeAlerta, IconeCirculoCheck, IconeFechar, IconeRelogio } from './icons';
import './Alerta.css';

export interface AlertaProps {
  tom: 'erro' | 'sucesso' | 'info' | 'aviso';
  titulo?: string;
  children?: ReactNode;
  onFechar?: () => void;
  acao?: ReactNode;
}

/** Mensagem em bloco. Erros usam `role="alert"`; os demais, `role="status"`. */
export function Alerta({ tom, titulo, children, onFechar, acao }: AlertaProps) {
  const Icone = tom === 'sucesso' ? IconeCirculoCheck : tom === 'info' ? IconeRelogio : IconeAlerta;
  return (
    <div className="jn-alerta" data-tom={tom} role={tom === 'erro' ? 'alert' : 'status'}>
      <Icone tamanho={20} className="jn-alerta__icone" />
      <div className="jn-alerta__texto">
        {titulo ? <p className="jn-alerta__titulo">{titulo}</p> : null}
        {children ? <div>{children}</div> : null}
        {acao ? <div className="jn-alerta__acao">{acao}</div> : null}
      </div>
      {onFechar ? (
        <button type="button" className="jn-alerta__fechar" onClick={onFechar} aria-label="Fechar mensagem">
          <IconeFechar tamanho={16} />
        </button>
      ) : null}
    </div>
  );
}
