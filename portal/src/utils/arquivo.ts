import { MENSAGENS } from '../api/mensagens';

/** Limite do contrato (FR-032): 10 MB = 10.485.760 bytes. */
export const LIMITE_BYTES = 10 * 1024 * 1024;
export const ACCEPT = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png';

const EXTENSOES = ['pdf', 'jpg', 'jpeg', 'png'];
const TIPOS = ['application/pdf', 'image/jpeg', 'image/png'];

function assinaturaValida(bytes: Uint8Array): boolean {
  const comeca = (assinatura: number[]) => assinatura.every((b, i) => bytes[i] === b);
  return (
    comeca([0x25, 0x50, 0x44, 0x46, 0x2d]) || // %PDF-
    comeca([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) || // PNG
    comeca([0xff, 0xd8, 0xff]) // JPEG
  );
}

async function lerInicio(arquivo: File): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await arquivo.slice(0, 8).arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Validação no cliente, antes de enviar (o servidor valida de novo): formato (extensão, tipo e
 * assinatura dos bytes — pega `.exe` renomeado), vazio e tamanho. Devolve a mensagem do contrato
 * ou `null` se o arquivo pode seguir.
 */
export async function validarArquivo(arquivo: File): Promise<string | null> {
  const extensao = arquivo.name.split('.').pop()?.toLowerCase() ?? '';
  const tipoOk = !arquivo.type || TIPOS.includes(arquivo.type);
  if (!EXTENSOES.includes(extensao) || !tipoOk) return MENSAGENS.ARQUIVO_TIPO_NAO_SUPORTADO;
  if (arquivo.size === 0) return MENSAGENS.ARQUIVO_INVALIDO;
  if (arquivo.size > LIMITE_BYTES) return MENSAGENS.ARQUIVO_MUITO_GRANDE;
  const inicio = await lerInicio(arquivo);
  if (inicio && !assinaturaValida(inicio)) return MENSAGENS.ARQUIVO_TIPO_NAO_SUPORTADO;
  return null;
}
