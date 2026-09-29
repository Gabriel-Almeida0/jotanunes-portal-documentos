import { Fragment, type ReactNode } from 'react';
import { HashRouter, Route, Routes, useParams } from 'react-router-dom';
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
import { TrocaSenha } from './pages/TrocaSenha';
import { Usuarios } from './pages/Usuarios';

export const FUTURO_ROUTER = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

/**
 * Remonta a página quando o parâmetro da rota muda (ex.: `/empresas/A` → `/empresas/B`). O React
 * Router reaproveita o mesmo componente entre rotas iguais com parâmetros diferentes; sem a chave,
 * modais abertos, formulários sujos e avisos da página anterior continuariam na nova (e ações
 * confirmadas no modal poderiam atingir o registro novo).
 */
function PorParametro({ nome, children }: { nome: string; children: ReactNode }) {
  const params = useParams();
  return <Fragment key={params[nome] ?? ''}>{children}</Fragment>;
}

/** Rotas da área Jotanunes (separadas do roteador para uso nos testes com MemoryRouter). */
export function RotasApp() {
  return (
    <div className="jn-app">
      <Layout>
        <Routes>
          <Route path="/" element={<Painel />} />
          <Route path="/obras" element={<Obras />} />
          <Route path="/obras/:obraId" element={<PorParametro nome="obraId"><ObraDetalhe /></PorParametro>} />
          <Route path="/empresas" element={<Empresas />} />
          <Route path="/empresas/:empresaId" element={<PorParametro nome="empresaId"><EmpresaDetalhe /></PorParametro>} />
          <Route path="/tipos-documento" element={<TiposDocumento />} />
          <Route path="/analise" element={<FilaAnalise />} />
          <Route path="/analise/:envioId" element={<PorParametro nome="envioId"><EnvioAnalise /></PorParametro>} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/trocar-senha" element={<TrocaSenha modo="voluntario" />} />
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
