import { Children, type FormEvent, type ReactNode } from 'react';
import { Botao } from './Botao';
import { IconeBusca } from './icons';
import './Filtros.css';

export interface FiltrosProps {
  /** Título à esquerda, no padrão "Encontre seu Jota:". */
  titulo?: string;
  onPesquisar: () => void;
  onLimpar?: () => void;
  children: ReactNode;
}

/**
 * Faixa de filtros no padrão "Encontre seu Jota" do site: título à esquerda, campos lado a lado e
 * botão vermelho "Pesquisar" na mesma linha (quebra em telas estreitas).
 */
export function Filtros({ titulo = 'Filtrar', onPesquisar, onLimpar, children }: FiltrosProps) {
  function enviar(e: FormEvent) {
    e.preventDefault();
    onPesquisar();
  }
  return (
    <form
      className={`jn-filtros ${Children.count(children) > 3 ? 'jn-filtros--muitos' : ''}`.trim()}
      role="search"
      aria-label={titulo}
      onSubmit={enviar}
    >
      <p className="jn-filtros__titulo" aria-hidden="true">
        {titulo}:
      </p>
      <div className="jn-filtros__campos">{children}</div>
      <div className="jn-filtros__acoes">
        <Botao type="submit" icone={<IconeBusca tamanho={18} />}>
          Pesquisar
        </Botao>
        {onLimpar ? (
          <Botao variante="fantasma" onClick={onLimpar}>
            Limpar
          </Botao>
        ) : null}
      </div>
    </form>
  );
}
