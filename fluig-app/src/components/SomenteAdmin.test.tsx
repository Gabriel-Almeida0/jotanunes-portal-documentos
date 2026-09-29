import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { UsuarioFluig } from '../api/tipos';
import { ContextoUsuarioFluig, useEhAdmin } from '../auth/contexto';
import { AvisoSomenteAdmin } from './AvisoSomenteAdmin';
import { SomenteAdmin } from './SomenteAdmin';

const ADMIN: UsuarioFluig = { login: 'maria', nome: 'Maria', email: 'maria@jotanunes.com', admin: true };
const COMUM: UsuarioFluig = { login: 'joao', nome: 'João', email: 'joao@jotanunes.com', admin: false };
const TEXTO = 'Só administradores podem cadastrar, alterar ou analisar. Se você precisa, fale com a TI.';

function comUsuario(usuario: UsuarioFluig, filhos: ReactNode) {
  return render(<ContextoUsuarioFluig.Provider value={usuario}>{filhos}</ContextoUsuarioFluig.Provider>);
}

function Perfil() {
  return <p>{useEhAdmin() ? 'perfil: admin' : 'perfil: comum'}</p>;
}

describe('useEhAdmin', () => {
  it('lê o campo admin do usuário identificado', () => {
    comUsuario(ADMIN, <Perfil />);
    expect(screen.getByText('perfil: admin')).toBeInTheDocument();
  });

  it('é falso para o usuário comum', () => {
    comUsuario(COMUM, <Perfil />);
    expect(screen.getByText('perfil: comum')).toBeInTheDocument();
  });
});

describe('SomenteAdmin', () => {
  it('mostra os filhos para o administrador', () => {
    comUsuario(ADMIN, <SomenteAdmin><button type="button">Novo tipo</button></SomenteAdmin>);
    expect(screen.getByRole('button', { name: 'Novo tipo' })).toBeEnabled();
  });

  it('não renderiza nada para o usuário comum (esconde, não desabilita)', () => {
    const { container } = comUsuario(COMUM, <SomenteAdmin><button type="button">Novo tipo</button></SomenteAdmin>);
    expect(screen.queryByRole('button', { name: 'Novo tipo' })).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('pode mostrar uma alternativa para o usuário comum', () => {
    comUsuario(COMUM, <SomenteAdmin senao={<p>Somente leitura</p>}><button type="button">Editar</button></SomenteAdmin>);
    expect(screen.getByText('Somente leitura')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  });
});

describe('AvisoSomenteAdmin', () => {
  it('explica em texto, como nota, para o usuário comum', () => {
    comUsuario(COMUM, <AvisoSomenteAdmin />);
    const nota = screen.getByRole('note');
    expect(nota).toHaveTextContent(TEXTO);
    expect(nota.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('não aparece para o administrador', () => {
    const { container } = comUsuario(ADMIN, <AvisoSomenteAdmin />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
