import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSessao, useUsuarioFluig } from '../auth/contexto';
import {
  IconeChave,
  IconeDocumento,
  IconeEmpresa,
  IconeFila,
  IconeMenu,
  IconeObra,
  IconePainel,
  IconeSair,
  IconeUsuario,
  IconeUsuarios,
} from './icons';
import './Layout.css';

const ITENS = [
  { para: '/', rotulo: 'Painel', Icone: IconePainel, fim: true },
  { para: '/obras', rotulo: 'Obras', Icone: IconeObra, fim: false },
  { para: '/empresas', rotulo: 'Empresas', Icone: IconeEmpresa, fim: false },
  { para: '/tipos-documento', rotulo: 'Tipos de documento', Icone: IconeDocumento, fim: false },
  { para: '/analise', rotulo: 'Fila de análise', Icone: IconeFila, fim: false },
];

/** Só para administrador (de qualquer origem): gestão dos usuários do login próprio (US9). */
const ITEM_USUARIOS = { para: '/usuarios', rotulo: 'Usuários', Icone: IconeUsuarios, fim: false };

/**
 * Layout da área Jotanunes: menu lateral claro, SEM cabeçalho de marca (o app abre dentro do Fluig,
 * que já tem o dele). Em telas estreitas o menu vira uma barra com botão "Menu".
 * "Usuários" só aparece para administrador; "Trocar senha" e "Sair" só na sessão de login próprio
 * (a sessão do Fluig é controlada pelo Fluig — FR-105).
 */
export function Layout({ children }: { children: ReactNode }) {
  const usuario = useUsuarioFluig();
  const { sair } = useSessao();
  const [saindo, setSaindo] = useState(false);
  const itens = usuario.admin ? [...ITENS, ITEM_USUARIOS] : ITENS;
  const loginLocal = usuario.origem === 'LOGIN_LOCAL';
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
            {itens.map(({ para, rotulo, Icone, fim }) => (
              <li key={para}>
                <NavLink to={para} end={fim} className="jn-layout__item">
                  <Icone tamanho={20} />
                  <span>{rotulo}</span>
                </NavLink>
              </li>
            ))}
          </ul>
          {loginLocal ? (
            <ul className="jn-layout__rodape">
              <li>
                <NavLink to="/trocar-senha" className="jn-layout__item">
                  <IconeChave tamanho={20} />
                  <span>Trocar senha</span>
                </NavLink>
              </li>
              <li>
                <button
                  type="button"
                  className="jn-layout__item jn-layout__sair"
                  disabled={saindo}
                  aria-busy={saindo || undefined}
                  onClick={() => {
                    setSaindo(true);
                    void sair().finally(() => setSaindo(false));
                  }}
                >
                  <IconeSair tamanho={20} />
                  <span>{saindo ? 'Saindo…' : 'Sair'}</span>
                </button>
              </li>
            </ul>
          ) : null}
        </nav>
      </aside>
      <main id="jn-conteudo" ref={conteudo} className="jn-layout__conteudo" tabIndex={-1}>
        <div className="jn-layout__container">{children}</div>
      </main>
    </div>
  );
}
