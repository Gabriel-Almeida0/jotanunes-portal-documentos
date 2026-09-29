import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { Blob as BlobNode, File as FileNode } from 'node:buffer';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '../mocks/server';
import { resetarDados } from '../mocks/dados';

// O fetch do Node (undici) não sabe ler o File/Blob/FormData do jsdom (a requisição trava).
// Nos testes usamos as classes nativas do Node, que o undici e o MSW entendem. O FormData nativo é
// obtido de uma Response do próprio undici, já que o jsdom sobrescreve o global.
const FormDataNode = (
  await new Response('', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  }).formData()
).constructor;
Object.assign(globalThis, { File: FileNode, Blob: BlobNode, FormData: FormDataNode });

// Primeira renderização de cada arquivo é mais lenta no jsdom; 1 s (padrão) fica no limite.
configure({ asyncUtilTimeout: 4000 });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetarDados();
  sessionStorage.clear();
});
afterAll(() => server.close());
