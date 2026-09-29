import { IconeCadeado } from '../components/icons';
import './AcessoNegado.css';

/** Tela exibida sem identidade Fluig válida. Não mostra nenhum dado. */
export function AcessoNegado() {
  return (
    <div className="jn-app jn-app--centro">
      <main className="jn-acesso-negado" aria-labelledby="jn-acesso-negado-titulo">
        <span className="jn-acesso-negado__icone" aria-hidden="true">
          <IconeCadeado tamanho={28} />
        </span>
        <span className="jn-acesso-negado__barra" aria-hidden="true" />
        <h1 id="jn-acesso-negado-titulo" className="jn-acesso-negado__titulo">
          Abra este sistema pelo Fluig.
        </h1>
        <p className="jn-acesso-negado__texto">
          Por segurança, a Documentação de Terceirizadas só funciona quando aberta a partir do Fluig. Volte ao Fluig e
          abra o sistema de novo pelo menu.
        </p>
        <p className="jn-acesso-negado__ajuda">Se o problema continuar, fale com a equipe de TI da Jotanunes.</p>
      </main>
    </div>
  );
}
