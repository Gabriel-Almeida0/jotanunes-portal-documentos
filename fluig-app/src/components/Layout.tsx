import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useUsuarioFluig } from '../auth/contexto';
import { IconeDocumento, IconeEmpresa, IconeFila, IconeMenu, IconeObra, IconePainel, IconeUsuario } from './icons';
import './Layout.css';

const ITENS = [
  { para: '/', rotulo: 'Painel', Icone: IconePainel, fim: true },
  { para: '/obras', rotulo: 'Obras', Icone: IconeObra, fim: false },
  { para: '/empresas', rotulo: 'Empresas', Icone: IconeEmpresa, fim: false },
  { para: '/tipos-documento', rotulo: 'Tipos de documento', Icone: IconeDocumento, fim: false },
  { para: '/analise', rotulo: 'Fila de análise', Icone: IconeFila, fim: false },
];

/**
 * Layout da área Jotanunes: menu lateral claro, SEM cabeçalho de marca (o app abre dentro do Fluig,
 * que já tem o dele). Em telas estreitas o menu vira uma barra com botão "Menu".
 */
export function Layout({ children }: { children: ReactNode }) {
  const usuario = useUsuarioFluig();
  const location = useLocation();
  const [menuAberto, setMenuAberto] = useState(false);
  const conteudo = useRef<HTMLElement>(null);
  const primeiraRota = useRef(true);

  // Ao trocar de página: fecha o menu móvel e leva o foco para o conteúdo (leitores de tela).
  useEffect(() => {
    setMenuAberto(false);
    if (primeiraRota.current) {
      primeiraRota.current = false;
      return;
    }
    conteudo.current?.focus({ preventScroll: true });
    window.scrollTo?.(0, 0);
  }, [location.pathname]);

  return (
    <div className="jn-layout">
      <a className="jn-layout__pular" href="#jn-conteudo" onClick={(e) => { e.preventDefault(); conteudo.current?.focus(); }}>
        Pular para o conteúdo
      </a>
      <aside className="jn-layout__lateral">
        <div className="jn-layout__topo">
          <div className="jn-layout__sistema">
            <span className="jn-layout__sistema-nome">Documentação de terceirizadas</span>
            <span className="jn-layout__usuario">
              <IconeUsuario tamanho={16} />
              <span>{usuario.nome}</span>
            </span>
          </div>
          <button
            type="button"
            className="jn-layout__botao-menu"
            aria-expanded={menuAberto}
            aria-controls="jn-menu-principal"
            onClick={() => setMenuAberto((v) => !v)}
          >
            <IconeMenu tamanho={20} />
            <span>Menu</span>
          </button>
        </div>
        <nav
          id="jn-menu-principal"
          className={`jn-layout__nav ${menuAberto ? 'jn-layout__nav--aberto' : ''}`}
          aria-label="Menu principal"
        >
          <ul>
            {ITENS.map(({ para, rotulo, Icone, fim }) => (
              <li key={para}>
                <NavLink to={para} end={fim} className="jn-layout__item">
                  <Icone tamanho={20} />
                  <span>{rotulo}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main id="jn-conteudo" ref={conteudo} className="jn-layout__conteudo" tabIndex={-1}>
        <div className="jn-layout__container">{children}</div>
      </main>
    </div>
  );
}
