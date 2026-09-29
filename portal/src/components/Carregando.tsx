import './Carregando.css';

/** Indicador de carregamento acessível (anunciado por leitores de tela). */
export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="jn-carregando" role="status">
      <span className="jn-carregando__giro" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}
