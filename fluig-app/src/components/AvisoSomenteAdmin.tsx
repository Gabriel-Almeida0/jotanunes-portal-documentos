import { useEhAdmin } from '../auth/contexto';
import { IconeInfo } from './icons';
import './AvisoSomenteAdmin.css';

export const TEXTO_SOMENTE_ADMIN =
  'Só administradores podem cadastrar, alterar ou analisar. Se você precisa, fale com a TI.';

/**
 * Aviso único por tela para o usuário comum: explica por que não há botões de cadastro/análise.
 * Não aparece para o administrador.
 */
export function AvisoSomenteAdmin() {
  if (useEhAdmin()) return null;
  return (
    <p className="jn-aviso-admin" role="note">
      <IconeInfo tamanho={20} className="jn-aviso-admin__icone" />
      <span>{TEXTO_SOMENTE_ADMIN}</span>
    </p>
  );
}
