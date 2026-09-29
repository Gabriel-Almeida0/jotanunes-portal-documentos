#!/usr/bin/env node
// Gera um token Fluig de DESENVOLVIMENTO (JWT HS256) conforme
// specs/001-portal-documentos-terceirizadas/contracts/fluig-identity.md.
//
// Uso: node scripts/gerar-token-fluig-dev.mjs [--admin] [login] [nome] [email]
//   --admin (em qualquer posição): administrador — o payload ganha "roles": ["admin"].
//   sem --admin: usuário comum — a claim "roles" é omitida.
//   Padrões: login dev.analista, nome "Analista Dev", email analista@jotanunes.com.
// Exemplos:
//   node scripts/gerar-token-fluig-dev.mjs --admin dev.admin "Admin Dev" admin@jotanunes.com
//   node scripts/gerar-token-fluig-dev.mjs dev.analista "Analista Dev" analista@jotanunes.com
// Segredo: variável de ambiente FLUIG_JWT_SECRET ou, se ausente, o .env da raiz do repositório.
import { createHmac } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function lerSegredo() {
  if (process.env.FLUIG_JWT_SECRET) return process.env.FLUIG_JWT_SECRET;
  const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
  const arquivoEnv = join(raiz, '.env');
  if (!existsSync(arquivoEnv)) return undefined;
  for (const linha of readFileSync(arquivoEnv, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*(?:export\s+)?FLUIG_JWT_SECRET\s*=\s*(.*)\s*$/);
    if (m) return m[1].replace(/^(['"])(.*)\1$/, '$2');
  }
  return undefined;
}

const USO = 'Uso: node scripts/gerar-token-fluig-dev.mjs [--admin] [login] [nome] [email]';

const argumentos = process.argv.slice(2);
const desconhecidas = argumentos.filter((a) => a.startsWith('--') && a !== '--admin');
if (desconhecidas.length > 0) {
  console.error(`Opção desconhecida: ${desconhecidas.join(', ')}`);
  console.error(USO);
  process.exit(1);
}
const admin = argumentos.includes('--admin');
const posicionais = argumentos.filter((a) => a !== '--admin');

const segredo = lerSegredo();
if (!segredo || Buffer.byteLength(segredo, 'utf8') < 32) {
  console.error('FLUIG_JWT_SECRET ausente ou com menos de 32 bytes (defina no ambiente ou no .env da raiz).');
  process.exit(1);
}

const [login = 'dev.analista', nome = 'Analista Dev', email = 'analista@jotanunes.com'] = posicionais;
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const iat = Math.floor(Date.now() / 1000);
const header = { alg: 'HS256', typ: 'JWT' };
const payload = {
  iss: 'fluig',
  aud: 'jotanunes-docs-api',
  sub: login,
  name: nome,
  email,
  ...(admin ? { roles: ['admin'] } : {}),
  iat,
  exp: iat + 8 * 60 * 60,
};
const dados = `${b64url(header)}.${b64url(payload)}`;
const assinatura = createHmac('sha256', segredo).update(dados).digest('base64url');
process.stdout.write(`${dados}.${assinatura}\n`);
