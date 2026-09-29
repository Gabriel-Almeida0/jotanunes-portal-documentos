#!/usr/bin/env node
// Falha se o package.json do portal tiver framework/biblioteca de CSS ou de componentes visuais
// (constituição, princípio V). Uso: `npm run check:css`.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROIBIDOS = [
  /^tailwindcss$/,
  /^@tailwindcss\//,
  /^bootstrap$/,
  /^react-bootstrap$/,
  /^reactstrap$/,
  /^@mui\//,
  /^@material-ui\//,
  /^@chakra-ui\//,
  /^antd$/,
  /^@ant-design\//,
  /^styled-components$/,
  /^@emotion\//,
  /^bulma$/,
  /^foundation-sites$/,
  /^semantic-ui/,
  /^@mantine\//,
  /^@radix-ui\/themes$/,
  /^@headlessui\//,
  /^primereact$/,
  /^daisyui$/,
  /^@shadcn\//,
  /^windicss$/,
  /^unocss$/,
  /^@unocss\//,
  /^@vanilla-extract\//,
  /^@stitches\//,
  /^styled-jsx$/,
  /^@fluentui\//,
  /^@nextui-org\//,
];

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const pacote = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
const dependencias = Object.keys({
  ...pacote.dependencies,
  ...pacote.devDependencies,
  ...pacote.peerDependencies,
  ...pacote.optionalDependencies,
});

const encontrados = dependencias.filter((nome) => PROIBIDOS.some((regra) => regra.test(nome)));

if (encontrados.length > 0) {
  console.error(
    `✗ Bibliotecas de CSS/componentes visuais proibidas no portal: ${encontrados.join(', ')}.\n` +
      '  Use CSS puro com os tokens --jn-* (docs/design.md).',
  );
  process.exit(1);
}
console.log(
  `✓ Nenhuma biblioteca de CSS/componentes visuais (${dependencias.length} pacotes conferidos).`,
);
