import { Link } from 'react-router-dom';
import logo from '../assets/logo-jotanunes.png';
import { useSessao } from '../auth/contexto';
import { formatarCnpj } from '../utils/cnpj';
import { IconeSair } from './icons';
import './Cabecalho.css';

/** Cabeçalho do portal: fundo `--jn-gray-100`, logo, empresa logada e "Sair" (FR-071). */
export function Cabecalho() {
  const { empresa, trocaSenhaObrigatoria, sair } = useSessao();
  const destinoLogo = empresa && !trocaSenhaObrigatoria ? '/documentos' : '/acesso';

  return (
    <header className="jn-cabecalho">
      <div className="jn-container jn-cabecalho__conteudo">
        <Link to={destinoLogo} className="jn-cabecalho__marca">
          <img src={logo} alt="Jotanunes Construtora" width={166} height={45} />
          <span className="jn-cabecalho__produto">Portal de documentos</span>
        </Link>

        {empresa && (
          <div className="jn-cabecalho__sessao">
            <p className="jn-cabecalho__empresa">
              <span className="jn-visually-hidden">Empresa conectada: </span>
              <span className="jn-cabecalho__razao" title={empresa.razaoSocial}>
                {empresa.razaoSocial}
              </span>
              <span className="jn-cabecalho__cnpj">CNPJ {formatarCnpj(empresa.cnpj)}</span>
            </p>
            <button type="button" className="jn-cabecalho__sair" onClick={() => sair()}>
              <IconeSair tamanho={18} />
              <span>Sair</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
