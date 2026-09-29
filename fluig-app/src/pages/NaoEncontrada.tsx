import { BotaoLink } from '../components/Botao';
import { EstadoVazio } from '../components/Estados';
import { TituloPagina } from '../components/TituloPagina';

export function NaoEncontrada() {
  return (
    <>
      <TituloPagina titulo="Página não encontrada" />
      <EstadoVazio
        titulo="Não encontramos o que você procurou."
        texto="Confira o endereço ou volte para o painel."
        acao={<BotaoLink to="/">Ir para o painel</BotaoLink>}
      />
    </>
  );
}
