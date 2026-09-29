import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { IconeAlerta, IconeOlho, IconeOlhoFechado } from './icons';
import './Campo.css';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  rotulo: string;
  erro?: string | null;
  ajuda?: ReactNode;
  /** Ajuda mostrada abaixo do campo (ex.: regras de senha). */
  ajudaAbaixo?: ReactNode;
  /** Campo de senha com botão "Mostrar senha". */
  senha?: boolean;
  id?: string;
}

export const Campo = forwardRef<HTMLInputElement, Props>(function Campo(
  { rotulo, erro, ajuda, ajudaAbaixo, senha = false, id, type, className, ...resto },
  ref,
) {
  const idGerado = useId();
  const idCampo = id ?? `campo-${idGerado}`;
  const idAjuda = `${idCampo}-ajuda`;
  const idErro = `${idCampo}-erro`;
  const idAjudaAbaixo = `${idCampo}-ajuda-abaixo`;
  const [mostrar, setMostrar] = useState(false);

  const descricao = [
    ajuda ? idAjuda : null,
    erro ? idErro : null,
    ajudaAbaixo ? idAjudaAbaixo : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={['jn-campo', erro && 'jn-campo--erro', className].filter(Boolean).join(' ')}>
      <label className="jn-campo__rotulo" htmlFor={idCampo}>
        {rotulo}
      </label>
      {ajuda && (
        <div className="jn-campo__ajuda" id={idAjuda}>
          {ajuda}
        </div>
      )}
      <div className="jn-campo__caixa">
        <input
          ref={ref}
          id={idCampo}
          className="jn-campo__entrada"
          type={senha ? (mostrar ? 'text' : 'password') : type}
          aria-invalid={erro ? true : undefined}
          aria-describedby={descricao || undefined}
          {...resto}
        />
        {senha && (
          <button
            type="button"
            className="jn-campo__olho"
            onClick={() => setMostrar((m) => !m)}
            aria-pressed={mostrar}
            aria-label={
              mostrar ? `Ocultar ${rotulo.toLowerCase()}` : `Mostrar ${rotulo.toLowerCase()}`
            }
          >
            {mostrar ? <IconeOlhoFechado /> : <IconeOlho />}
          </button>
        )}
      </div>
      {erro && (
        <p className="jn-campo__erro" id={idErro}>
          <IconeAlerta tamanho={16} />
          <span>{erro}</span>
        </p>
      )}
      {ajudaAbaixo && (
        <div className="jn-campo__ajuda" id={idAjudaAbaixo}>
          {ajudaAbaixo}
        </div>
      )}
    </div>
  );
});
