#!/usr/bin/env node
/**
 * Falha (exit 1) se o package.json declarar framework/biblioteca de CSS ou de componentes visuais.
 * Constituição, princípio V: só CSS puro com as variáveis --jn-* de docs/design.md.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const pacote = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));

const PROIBIDOS_EXATOS = [
  'tailwindcss', '@tailwindcss/vite', '@tailwindcss/postcss', 'windicss', 'unocss',
  'bootstrap', 'react-bootstrap', 'reactstrap',
  'styled-components', 'styled-jsx', 'goober', 'stitches', '@stitches/react',
  'antd', 'semantic-ui-react', 'semantic-ui-css', 'bulma', 'foundation-sites', 'materialize-css',
  'primereact', 'primeflex', 'rsuite', 'evergreen-ui', 'grommet', 'rebass', 'theme-ui',
  '@vanilla-extract/css', 'linaria', '@linaria/core', 'jss', 'react-jss', 'twin.macro',
  'daisyui', 'flowbite', 'flowbite-react', '@headlessui/react', '@nextui-org/react',
  'framer-motion', '@shadcn/ui', 'shadcn-ui',
];
const PROIBIDOS_PREFIXOS = [
  '@mui/', '@material-ui/', '@chakra-ui/', '@emotion/', '@mantine/', '@radix-ui/themes',
  '@fluentui/', '@blueprintjs/', '@ant-design/', '@heroui/', '@park-ui/', '@pandacss/',
];

const dependencias = {
  ...pacote.dependencies,
  ...pacote.devDependencies,
  ...pacote.peerDependencies,
  ...pacote.optionalDependencies,
};

const encontrados = Object.keys(dependencias).filter(
  (nome) => PROIBIDOS_EXATOS.includes(nome) || PROIBIDOS_PREFIXOS.some((p) => nome.startsWith(p)),
);

if (encontrados.length > 0) {
  console.error('Bibliotecas de CSS/componentes visuais não são permitidas (constituição, princípio V):');
  for (const nome of encontrados) console.error(`  - ${nome}`);
  console.error('Use CSS puro com os tokens --jn-* (src/styles/tokens.css).');
  process.exit(1);
}

console.log(`OK: nenhuma biblioteca de CSS/componentes visuais entre ${Object.keys(dependencias).length} dependências.`);
