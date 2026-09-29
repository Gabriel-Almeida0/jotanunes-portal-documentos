import logo from '../assets/logo-jotanunes.png';
import './Rodape.css';

export function Rodape() {
  const ano = new Date().getFullYear();
  return (
    <footer className="jn-rodape">
      <div className="jn-container jn-rodape__conteudo">
        <img src={logo} alt="Jotanunes Construtora" width={118} height={32} />
        <p>© {ano} Jotanunes Construtora</p>
        <p className="jn-rodape__ajuda">
          Dúvidas sobre os documentos? Fale com a equipe da Jotanunes que enviou o seu convite.
        </p>
      </div>
    </footer>
  );
}
