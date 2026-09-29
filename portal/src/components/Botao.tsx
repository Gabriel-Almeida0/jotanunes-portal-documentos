import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import './Botao.css';

type Variante = 'primario' | 'secundario' | 'pill' | 'link';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  /** Mostra o indicador e troca o texto enquanto a ação roda. */
  carregando?: boolean;
  textoCarregando?: string;
  icone?: ReactNode;
  bloco?: boolean;
}

export const Botao = forwardRef<HTMLButtonElement, Props>(function Botao(
  {
    variante = 'primario',
    carregando = false,
    textoCarregando,
    icone,
    bloco = false,
    className,
    children,
    disabled,
    type = 'button',
    ...resto
  },
  ref,
) {
  const classes = ['jn-botao', `jn-botao--${variante}`, bloco && 'jn-botao--bloco', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...resto}
    >
      {carregando ? <span className="jn-botao__giro" aria-hidden="true" /> : icone}
      <span>{carregando && textoCarregando ? textoCarregando : children}</span>
    </button>
  );
});
