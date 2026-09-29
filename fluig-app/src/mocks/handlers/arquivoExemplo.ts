/**
 * Arquivos de exemplo servidos pelos mocks no download (o conteúdo real fica no backend).
 */

/** PDF de 1 página com o nome do arquivo escrito (offsets do xref calculados). */
export function pdfExemplo(titulo: string): Uint8Array {
  const seguro = titulo.replace(/[()\\]/g, ' ').replace(/[^\x20-\x7E]/g, '?');
  const conteudo = [
    'BT /F1 20 Tf 72 740 Td (Documento de exemplo - mocks) Tj ET',
    `BT /F1 12 Tf 72 712 Td (${seguro}) Tj ET`,
    'BT /F1 11 Tf 72 690 Td (Arquivo gerado pelos mocks do fluig-app. O arquivo real vem da API.) Tj ET',
  ].join('\n');
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let saida = '%PDF-1.4\n';
  const offsets: number[] = [];
  objetos.forEach((obj, i) => {
    offsets.push(saida.length);
    saida += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = saida.length;
  saida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) saida += `${String(o).padStart(10, '0')} 00000 n \n`;
  saida += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(saida);
}

/** PNG 1×1 cinza (serve também para "JPEG" nos mocks; o navegador identifica pelo conteúdo). */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN4+f//fwAJ5gPyGyC3SQAAAABJRU5ErkJggg==';

export function pngExemplo(): Uint8Array {
  const bin = atob(PNG_BASE64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
