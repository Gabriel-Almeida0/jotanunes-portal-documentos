import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from '../mocks/server';
import { reiniciarDados, reiniciarSessaoMock } from '../mocks/dados';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
  // jsdom não implementa rolagem.
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
  // Padrão dos testes: administrador entrando pelo Fluig, login próprio ligado.
  reiniciarSessaoMock();
  reiniciarDados();
  window.sessionStorage.clear();
});
afterAll(() => server.close());
