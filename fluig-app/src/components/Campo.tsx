import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import './Campo.css';

interface BaseCampo {
  rotulo: string;
  erro?: string | null;
  ajuda?: ReactNode;
  obrigatorio?: boolean;
  /** Texto à direita do rótulo (ex.: contador "12/500"). */
  complemento?: ReactNode;
  className?: string;
}

function useIdsCampo(idExterno?: string) {
  const gerado = useId();
  const id = idExterno ?? `campo-${gerado}`;
  return { id, idErro: `${id}-erro`, idAjuda: `${id}-ajuda` };
}

function Moldura({
  id,
  idErro,
  idAjuda,
  rotulo,
  erro,
  ajuda,
  obrigatorio,
  complemento,
  className,
  children,
}: BaseCampo & { id: string; idErro: string; idAjuda: string; children: ReactNode }) {
  return (
    <div className={`jn-campo ${erro ? 'jn-campo--erro' : ''} ${className ?? ''}`.trim()}>
      <div className="jn-campo__topo">
        <label className="jn-campo__rotulo" htmlFor={id}>
          {rotulo}
          {obrigatorio ? (
            <span className="jn-campo__obrigatorio" aria-hidden="true">
              {' '}
              *
            </span>
          ) : null}
        </label>
        {complemento ? <span className="jn-campo__complemento">{complemento}</span> : null}
      </div>
      {children}
      {ajuda ? (
        <p className="jn-campo__ajuda" id={idAjuda}>
          {ajuda}
        </p>
      ) : null}
      {erro ? (
        <p className="jn-campo__erro" id={idErro}>
          {erro}
        </p>
      ) : null}
    </div>
  );
}

function descricao(erro: string | null | undefined, ajuda: ReactNode, idErro: string, idAjuda: string) {
  const ids = [ajuda ? idAjuda : null, erro ? idErro : null].filter(Boolean).join(' ');
  return ids || undefined;
}

export type CampoProps = BaseCampo & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>;

export const Campo = forwardRef<HTMLInputElement, CampoProps>(function Campo(
  { rotulo, erro, ajuda, obrigatorio, complemento, className, id: idExterno, ...resto },
  ref,
) {
  const { id, idErro, idAjuda } = useIdsCampo(idExterno);
  return (
    <Moldura {...{ id, idErro, idAjuda, rotulo, erro, ajuda, obrigatorio, complemento, className }}>
      <input
        ref={ref}
        id={id}
        className="jn-campo__controle"
        required={obrigatorio}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(erro, ajuda, idErro, idAjuda)}
        {...resto}
      />
    </Moldura>
  );
});

export type CampoSelecaoProps = BaseCampo &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> & { children: ReactNode };

export const CampoSelecao = forwardRef<HTMLSelectElement, CampoSelecaoProps>(function CampoSelecao(
  { rotulo, erro, ajuda, obrigatorio, complemento, className, id: idExterno, children, ...resto },
  ref,
) {
  const { id, idErro, idAjuda } = useIdsCampo(idExterno);
  return (
    <Moldura {...{ id, idErro, idAjuda, rotulo, erro, ajuda, obrigatorio, complemento, className }}>
      <select
        ref={ref}
        id={id}
        className="jn-campo__controle jn-campo__controle--selecao"
        required={obrigatorio}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(erro, ajuda, idErro, idAjuda)}
        {...resto}
      >
        {children}
      </select>
    </Moldura>
  );
});

export type CampoAreaProps = BaseCampo &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>;

export const CampoArea = forwardRef<HTMLTextAreaElement, CampoAreaProps>(function CampoArea(
  { rotulo, erro, ajuda, obrigatorio, complemento, className, id: idExterno, ...resto },
  ref,
) {
  const { id, idErro, idAjuda } = useIdsCampo(idExterno);
  return (
    <Moldura {...{ id, idErro, idAjuda, rotulo, erro, ajuda, obrigatorio, complemento, className }}>
      <textarea
        ref={ref}
        id={id}
        className="jn-campo__controle jn-campo__controle--area"
        required={obrigatorio}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descricao(erro, ajuda, idErro, idAjuda)}
        {...resto}
      />
    </Moldura>
  );
});
