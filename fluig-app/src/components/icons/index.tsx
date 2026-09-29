/**
 * Ícones de linha (estilo Lucide), SVG inline, sem biblioteca.
 * Decorativos por padrão (`aria-hidden`); passe `titulo` para ícones com significado próprio.
 */
import type { ReactNode, SVGProps } from 'react';

export interface IconeProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  tamanho?: number;
  titulo?: string;
}

function criar(nome: string, desenho: ReactNode) {
  function Icone({ tamanho = 20, titulo, className, ...resto }: IconeProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={tamanho}
        height={tamanho}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={titulo ? undefined : true}
        role={titulo ? 'img' : undefined}
        focusable="false"
        className={`jn-icone ${className ?? ''}`.trim()}
        {...resto}
      >
        {titulo ? <title>{titulo}</title> : null}
        {desenho}
      </svg>
    );
  }
  Icone.displayName = `Icone${nome}`;
  return Icone;
}

export const IconePainel = criar(
  'Painel',
  <>
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </>,
);

export const IconeObra = criar(
  'Obra',
  <>
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
  </>,
);

export const IconeEmpresa = criar(
  'Empresa',
  <>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </>,
);

export const IconeDocumento = criar(
  'Documento',
  <>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M10 9H8M16 13H8M16 17H8" />
  </>,
);

export const IconeFila = criar(
  'Fila',
  <>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="m9 14 2 2 4-4" />
  </>,
);

export const IconePin = criar(
  'Pin',
  <>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </>,
);

export const IconeSeta = criar('Seta', <path d="M5 12h14M12 5l7 7-7 7" />);
export const IconeVoltar = criar('Voltar', <path d="M19 12H5M12 19l-7-7 7-7" />);
export const IconeMais = criar('Mais', <path d="M12 5v14M5 12h14" />);
export const IconeFechar = criar('Fechar', <path d="M18 6 6 18M6 6l12 12" />);
export const IconeCheck = criar('Check', <path d="M20 6 9 17l-5-5" />);
export const IconeBusca = criar(
  'Busca',
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>,
);
export const IconeLapis = criar(
  'Lapis',
  <>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </>,
);
export const IconeEmail = criar(
  'Email',
  <>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </>,
);
export const IconeRelogio = criar(
  'Relogio',
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </>,
);
export const IconeAlerta = criar(
  'Alerta',
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </>,
);
export const IconeInfo = criar(
  'Info',
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </>,
);
export const IconeCirculoCheck = criar(
  'CirculoCheck',
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </>,
);
export const IconeCirculoX = criar(
  'CirculoX',
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m15 9-6 6M9 9l6 6" />
  </>,
);
export const IconeCirculo = criar('Circulo', <circle cx="12" cy="12" r="9" />);
export const IconeAbrir = criar(
  'Abrir',
  <>
    <path d="M15 3h6v6M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </>,
);
export const IconeDownload = criar(
  'Download',
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m7 10 5 5 5-5M12 15V3" />
  </>,
);
export const IconeMenu = criar('Menu', <path d="M4 6h16M4 12h16M4 18h16" />);
export const IconeUsuario = criar(
  'Usuario',
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </>,
);
export const IconeCadeado = criar(
  'Cadeado',
  <>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </>,
);
export const IconeLink = criar(
  'Link',
  <>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </>,
);
export const IconeRecarregar = criar(
  'Recarregar',
  <>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 21v-5h5" />
  </>,
);
export const IconeUsuarios = criar(
  'Usuarios',
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </>,
);
export const IconeChave = criar(
  'Chave',
  <>
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" />
  </>,
);
export const IconeSair = criar(
  'Sair',
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </>,
);
