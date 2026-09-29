import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Botao, type VarianteBotao } from './Botao';
import { Alerta } from './Alerta';
import { IconeFechar } from './icons';
import './Modal.css';

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  /** Impede fechar (Esc/fundo/X) enquanto uma ação está em andamento. */
  bloqueado?: boolean;
  largura?: 'normal' | 'larga';
  /** id do elemento que deve receber o foco ao abrir (padrão: primeiro campo/botão). */
  focoInicial?: string;
}

/**
 * Diálogo modal acessível: `role="dialog"`, `aria-modal`, título ligado por `aria-labelledby`,
 * foco preso dentro do diálogo, Esc fecha, foco volta para quem abriu.
 */
export function Modal({ aberto, titulo, onFechar, children, rodape, bloqueado, largura = 'normal', focoInicial }: ModalProps) {
  const idTitulo = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const anterior = useRef<HTMLElement | null>(null);
  const fecharRef = useRef(onFechar);
  fecharRef.current = onFechar;
  const bloqueadoRef = useRef(bloqueado);
  bloqueadoRef.current = bloqueado;

  useEffect(() => {
    if (!aberto) return;
    anterior.current = document.activeElement as HTMLElement | null;
    const el = caixa.current;
    const alvo =
      (focoInicial ? el?.querySelector<HTMLElement>(`#${CSS.escape(focoInicial)}`) : null) ??
      el?.querySelector<HTMLElement>('.jn-modal__corpo ' + FOCAVEIS.split(', ').join(', .jn-modal__corpo ')) ??
      el?.querySelector<HTMLElement>(FOCAVEIS);
    (alvo ?? el)?.focus();

    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape' && !bloqueadoRef.current) {
        e.stopPropagation();
        fecharRef.current();
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const itens = Array.from(el.querySelectorAll<HTMLElement>(FOCAVEIS));
      if (itens.length === 0) return;
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    }
    document.addEventListener('keydown', tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = overflow;
      anterior.current?.focus?.();
    };
  }, [aberto, focoInicial]);

  if (!aberto) return null;

  return (
    <div
      className="jn-modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !bloqueado) onFechar();
      }}
    >
      <div
        ref={caixa}
        className={`jn-modal__caixa ${largura === 'larga' ? 'jn-modal__caixa--larga' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
      >
        <div className="jn-modal__cabecalho">
          <h2 className="jn-modal__titulo" id={idTitulo}>
            {titulo}
          </h2>
          <button
            type="button"
            className="jn-modal__fechar"
            onClick={onFechar}
            disabled={bloqueado}
            aria-label="Fechar"
          >
            <IconeFechar tamanho={20} />
          </button>
        </div>
        <div className="jn-modal__corpo">{children}</div>
        {rodape ? <div className="jn-modal__rodape">{rodape}</div> : null}
      </div>
    </div>
  );
}

export interface ModalConfirmacaoProps {
  aberto: boolean;
  titulo: string;
  mensagem: ReactNode;
  rotuloConfirmar: string;
  rotuloCancelar?: string;
  variante?: VarianteBotao;
  carregando?: boolean;
  erro?: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ModalConfirmacao({
  aberto,
  titulo,
  mensagem,
  rotuloConfirmar,
  rotuloCancelar = 'Cancelar',
  variante = 'primario',
  carregando,
  erro,
  onConfirmar,
  onCancelar,
}: ModalConfirmacaoProps) {
  return (
    <Modal
      aberto={aberto}
      titulo={titulo}
      onFechar={onCancelar}
      bloqueado={carregando}
      rodape={
        <>
          <Botao variante="secundario" onClick={onCancelar} disabled={carregando}>
            {rotuloCancelar}
          </Botao>
          <Botao variante={variante} onClick={onConfirmar} carregando={carregando}>
            {rotuloConfirmar}
          </Botao>
        </>
      }
    >
      <div className="jn-modal__mensagem">{mensagem}</div>
      {erro ? <Alerta tom="erro">{erro}</Alerta> : null}
    </Modal>
  );
}
