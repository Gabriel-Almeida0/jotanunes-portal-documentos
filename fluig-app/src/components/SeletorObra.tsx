import { useId } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useObraSelecionada } from '../obra/contexto';
import { IconeObra } from './icons';
import './SeletorObra.css';

/** Detalhes que deixam de fazer sentido ao trocar de obra: voltam para a lista da aba. */
const DETALHE_PARA_LISTA: [RegExp, string][] = [
  [/^\/empresas\/[^/]+$/, '/empresas'],
  [/^\/analise\/[^/]+$/, '/analise'],
];

/** Filtros da página que dependem da obra (empresa escolhida, página da lista). */
const PARAMETROS_DA_OBRA = ['pagina', 'empresaId'];

/**
 * Filtro geral por obra, fixo no menu lateral: vale para todas as abas que mostram dados de
 * empresas e documentos.
 */
export function SeletorObra() {
  const { obraId, obras, carregando, selecionar } = useObraSelecionada();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const id = useId();

  function trocar(novo: string) {
    if (novo === obraId) return;
    selecionar(novo);

    const caminho = location.pathname;
    if (/^\/obras\/[^/]+$/.test(caminho)) {
      navigate(novo ? `/obras/${encodeURIComponent(novo)}` : '/obras');
      return;
    }
    const lista = DETALHE_PARA_LISTA.find(([padrao]) => padrao.test(caminho))?.[1];
    if (lista) {
      navigate(lista);
      return;
    }
    if (PARAMETROS_DA_OBRA.some((p) => params.has(p))) {
      const limpos = new URLSearchParams(params);
      PARAMETROS_DA_OBRA.forEach((p) => limpos.delete(p));
      setParams(limpos, { replace: true });
    }
  }

  return (
    <div className={`jn-seletor-obra ${obraId ? 'jn-seletor-obra--ativo' : ''}`.trim()}>
      <label className="jn-seletor-obra__rotulo" htmlFor={id}>
        <IconeObra tamanho={16} />
        <span>Obra</span>
      </label>
      <select
        id={id}
        className="jn-seletor-obra__campo"
        value={obraId}
        disabled={carregando}
        aria-describedby={`${id}-ajuda`}
        onChange={(e) => trocar(e.target.value)}
      >
        <option value="">Todas as obras</option>
        {obras.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
            {o.ativa ? '' : ' (inativa)'}
          </option>
        ))}
      </select>
      <span className="jn-sr-only" id={`${id}-ajuda`}>
        Filtra painel, empresas e fila de análise pela obra escolhida.
      </span>
    </div>
  );
}
