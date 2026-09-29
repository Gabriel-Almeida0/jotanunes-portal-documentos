import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import './Botao.css';

export type VarianteBotao = 'primario' | 'secundario' | 'fantasma' | 'perigo';

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBotao;
  tamanho?: 'normal' | 'pequeno';
  icone?: ReactNode;
  carregando?: boolean;
  /** Texto exibido enquanto `carregando` (padrão: o próprio texto). */
  textoCarregando?: string;
}

function classes(variante: VarianteBotao, tamanho: 'normal' | 'pequeno', extra?: string) {
  return ['jn-botao', `jn-botao--${variante}`, tamanho === 'pequeno' ? 'jn-botao--pequeno' : '', extra ?? '']
    .filter(Boolean)
    .join(' ');
}

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(function Botao(
  {
    variante = 'primario',
    tamanho = 'normal',
    icone,
    carregando = false,
    textoCarregando,
    className,
    children,
    disabled,
    type = 'button',
    ...resto
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classes(variante, tamanho, className)}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...resto}
    >
      {carregando ? <span className="jn-botao__giro" aria-hidden="true" /> : icone}
      <span>{carregando && textoCarregando ? textoCarregando : children}</span>
    </button>
  );
});

export interface BotaoLinkProps extends LinkProps {
  variante?: VarianteBotao;
  tamanho?: 'normal' | 'pequeno';
  icone?: ReactNode;
}

/** Link com aparência de botão (navegação). */
export function BotaoLink({ variante = 'primario', tamanho = 'normal', icone, className, children, ...resto }: BotaoLinkProps) {
  return (
    <Link className={classes(variante, tamanho, className)} {...resto}>
      {icone}
      <span>{children}</span>
    </Link>
  );
}
