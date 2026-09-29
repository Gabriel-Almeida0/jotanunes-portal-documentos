import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { EmpresaDetalhe } from './pages/EmpresaDetalhe';
import { Empresas } from './pages/Empresas';
import { EnvioAnalise } from './pages/EnvioAnalise';
import { FilaAnalise } from './pages/FilaAnalise';
import { NaoEncontrada } from './pages/NaoEncontrada';
import { ObraDetalhe } from './pages/ObraDetalhe';
import { Obras } from './pages/Obras';
import { Painel } from './pages/Painel';
import { TiposDocumento } from './pages/TiposDocumento';

export const FUTURO_ROUTER = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

/** Rotas da área Jotanunes (separadas do roteador para uso nos testes com MemoryRouter). */
export function RotasApp() {
  return (
    <div className="jn-app">
      <Layout>
        <Routes>
          <Route path="/" element={<Painel />} />
          <Route path="/obras" element={<Obras />} />
          <Route path="/obras/:obraId" element={<ObraDetalhe />} />
          <Route path="/empresas" element={<Empresas />} />
          <Route path="/empresas/:empresaId" element={<EmpresaDetalhe />} />
          <Route path="/tipos-documento" element={<TiposDocumento />} />
          <Route path="/analise" element={<FilaAnalise />} />
          <Route path="/analise/:envioId" element={<EnvioAnalise />} />
          <Route path="*" element={<NaoEncontrada />} />
        </Routes>
      </Layout>
    </div>
  );
}

/** HashRouter: o app roda em iframe/caminho do Fluig sem regra de reescrita no servidor. */
export default function App() {
  return (
    <HashRouter future={FUTURO_ROUTER}>
      <RotasApp />
    </HashRouter>
  );
}
