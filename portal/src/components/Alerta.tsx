import type { ReactNode } from 'react';
import { IconeAlerta, IconeCheck, IconeInfo } from './icons';
import './Alerta.css';

type Tipo = 'erro' | 'sucesso' | 'info' | 'aviso';

interface Props {
  tipo: Tipo;
  titulo?: string;
  children?: ReactNode;
  className?: string;
}

const ICONE = { erro: IconeAlerta, aviso: IconeAlerta, sucesso: IconeCheck, info: IconeInfo };

/** Mensagem de erro/sucesso com texto e ícone. Erro usa `role="alert"`; os demais, `status`. */
export function Alerta({ tipo, titulo, children, className }: Props) {
  const Icone = ICONE[tipo];
  return (
    <div
      className={['jn-alerta', `jn-alerta--${tipo}`, className].filter(Boolean).join(' ')}
      role={tipo === 'erro' ? 'alert' : 'status'}
    >
      <Icone className="jn-alerta__icone" />
      <div className="jn-alerta__texto">
        {titulo && <p className="jn-alerta__titulo">{titulo}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
