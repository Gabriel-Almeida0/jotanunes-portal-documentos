/** Link para o detalhe da empresa já no bloco desta obra (002, US4). */
export function caminhoEmpresaNaObra(empresaId: string, obraId: string): string {
  return `/empresas/${empresaId}?obra=${encodeURIComponent(obraId)}`;
}
