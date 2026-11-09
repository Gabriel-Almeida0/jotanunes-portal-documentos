import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from '../mocks/server';
import { fixarRelogioMock, reiniciarDados, reiniciarSessaoMock } from '../mocks/dados';

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
  // Testes de períodos (003) fixam o relógio do mock; volta ao relógio real.
  fixarRelogioMock(null);
  reiniciarDados();
  window.sessionStorage.clear();
});
afterAll(() => server.close());
