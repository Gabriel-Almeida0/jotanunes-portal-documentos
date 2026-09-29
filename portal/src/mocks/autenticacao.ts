import { empresaDoToken, type EmpresaMock } from './dados';
import { problema } from './problema';

/**
 * Autentica a requisição como o esquema `portalAuth`. Com `completo`, recusa quem ainda precisa
 * trocar a senha (política `PortalCompleto` → 403 TROCA_SENHA_OBRIGATORIA).
 */
export function autenticar(
  request: Request,
  completo: boolean,
): { empresa: EmpresaMock } | { resposta: Response } {
  const emp = empresaDoToken(request.headers.get('Authorization'));
  if (!emp) return { resposta: problema(401, 'NAO_AUTENTICADO') };
  if (completo && emp.empresa.trocaSenhaObrigatoria) {
    return { resposta: problema(403, 'TROCA_SENHA_OBRIGATORIA') };
  }
  return { empresa: emp };
}
