import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { RotaProtegida } from './auth/RotaProtegida';
import { SessaoProvider } from './auth/SessaoProvider';
import { Cabecalho } from './components/Cabecalho';
import { Rodape } from './components/Rodape';
import { Acesso } from './pages/Acesso';
import { DocumentoHistorico } from './pages/DocumentoHistorico';
import { MeusDocumentos } from './pages/MeusDocumentos';
import { TrocaSenha } from './pages/TrocaSenha';

function Layout() {
  return (
    <>
      <a className="jn-skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <Cabecalho />
      <main id="conteudo" className="jn-principal">
        <Outlet />
      </main>
      <Rodape />
    </>
  );
}

/** Rotas do portal (separadas do roteador para os testes usarem `MemoryRouter`). */
export function Rotas() {
  return (
    <SessaoProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/acesso" element={<Acesso />} />
          <Route
            path="/trocar-senha"
            element={
              <RotaProtegida paraTrocaDeSenha>
                <TrocaSenha />
              </RotaProtegida>
            }
          />
          <Route
            path="/documentos"
            element={
              <RotaProtegida>
                <MeusDocumentos />
              </RotaProtegida>
            }
          />
          <Route
            path="/documentos/:tipoDocumentoId"
            element={
              <RotaProtegida>
                <DocumentoHistorico />
              </RotaProtegida>
            }
          />
          <Route path="/" element={<Navigate to="/documentos" replace />} />
          <Route path="*" element={<Navigate to="/documentos" replace />} />
        </Route>
      </Routes>
    </SessaoProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Rotas />
    </BrowserRouter>
  );
}
