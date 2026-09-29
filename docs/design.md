# Design — Portal de Documentação de Terceirizadas Jotanunes

> **Fonte:** identidade visual extraída de [jotanunes.com](https://jotanunes.com) em 28/09/2026. Os valores vêm do CSS computado do site: medidos, não estimados.
> **Uso:** base visual para o sistema novo (lado Jotanunes integrado ao Fluig + portal da empresa terceirizada), conforme o áudio de requisitos (`transcricao.txt`).
> **Referências visuais:** pasta [`design-referencias/`](design-referencias/).

---

## 1. Essência da marca

| Atributo | Como aparece no site |
|---|---|
| **Personalidade** | Próxima, confiante, otimista. Fala de "você" e usa o apelido "Jota" ("Encontre seu Jota", "Porque a Jota?", "Blog do Jota"). |
| **Cor-assinatura** | Vermelho vivo, usado com parcimônia: botões, selos, ícones de ação, setas, links. |
| **Base** | Branco e cinzas muito claros; o conteúdo respira. |
| **Forma-assinatura** | Canto **assimétrico** `20px 0`: arredonda só o superior-esquerdo e o inferior-direito. Aparece em fotos e cards. |
| **Tipografia** | Uma família só, **Montserrat**, variando o peso. |

**Tradução para o portal:** o site é de vendas (emocional, fotos grandes); o portal é operacional (tabelas, formulários, status). Levamos para o portal a **paleta, a tipografia, a forma-assinatura e o tom de voz**, e deixamos de fora os carrosséis, os banners e as fotos grandes.

---

## 2. Logo

- Arquivo: [`design-referencias/logo-jotanunes.png`](design-referencias/logo-jotanunes.png), 166×45 px, versão usada no cabeçalho do site.
- Símbolo: barras verticais em vermelho formando um "J" estilizado + palavra "Jotanunes" em cinza-escuro + "CONSTRUTORA" abaixo, em caixa alta pequena.
- Variação **branca** existe (usada sobre fotos nos banners).
- Altura no cabeçalho: **~45 px**.
- ⚠️ O PNG tem só 166 px de largura. Para produção, **pedir à Jotanunes o SVG oficial** (e a versão branca).

---

## 3. Cores

### 3.1 Paleta extraída

| Token | Hex | Onde aparece no site |
|---|---|---|
| `red-600` | `#D60000` | Vermelho principal: selos de status, setas de carrossel, barra de destaque dos títulos, ícones sociais |
| `red-500` | `#DF1A1A` | Fundo dos botões ("Pesquisar", "Ver todas") |
| `red-700` | `#BD1E1B` | Links de texto e menu ativo ("Home", "Saiba mais") |
| `navy-800` | `#152860` | Nome do empreendimento nos cards (secundária, pouco usada) |
| `gray-900` | `#212529` | Títulos de card, texto forte |
| `gray-800` | `#333333` | Texto padrão do corpo |
| `gray-700` | `#494949` | Fundo da seção escura ("Cidades em Atuação", com textura) |
| `gray-600` | `#54595F` | Texto de campos de formulário |
| `gray-500` | `#676767` | Texto secundário / descrições |
| `gray-400` | `#ACACAC` | Bordas de cards |
| `gray-300` | `#AFB0B1` | Títulos de seção grandes ("Oportunidades Exclusivas"): **só decorativo, ver 3.3** |
| `gray-100` | `#F2F2F2` | Fundo do cabeçalho |
| `gray-50` | `#F8F8F8` | Fundo de seções alternadas |
| `white` | `#FFFFFF` | Fundo principal, cards |

### 3.2 Proporção de uso
Aproximadamente **80% neutros** (branco/cinzas), **15% texto escuro** e **5% vermelho**. O vermelho chama atenção porque é raro; não usar em áreas grandes.

### 3.3 Acessibilidade (contraste WCAG, medido)

| Combinação | Contraste | Veredito |
|---|---|---|
| `#212529` sobre branco | 15,4 : 1 | ✅ AAA |
| `#152860` sobre branco | 14,0 : 1 | ✅ AAA |
| `#BD1E1B` sobre branco | 6,2 : 1 | ✅ AA; **usar este vermelho para texto/links** |
| `#D60000` sobre branco (e branco sobre ele) | 5,4 : 1 | ✅ AA |
| `#676767` sobre branco | 5,7 : 1 | ✅ AA; bom para texto secundário |
| Branco sobre `#DF1A1A` | 4,9 : 1 | ✅ AA (limite); ok para botões |
| `#7A7A7A` sobre branco | 4,3 : 1 | ⚠️ Falha AA em texto normal |
| `#AFB0B1` sobre branco | 2,2 : 1 | ❌ Falha. No portal, **títulos de seção usam `gray-900`**, não o cinza-claro do site |
| `#ACACAC` (borda) sobre branco | 2,3 : 1 | ✅ Ok para borda decorativa; **não** para borda de campo de formulário (usar `#676767`) |

### 3.4 Cores de status (novas, para o portal)
O site não tem estados de sistema. Proposta para status de documento, harmonizada com a paleta:

| Status | Texto | Fundo | Observação |
|---|---|---|---|
| Aprovado | `#1E7A3A` | `#E6F4EA` | Verde sóbrio |
| Em análise | `#1A4B8C` | `#E8F1FB` | Azul puxado ao `navy-800` |
| Pendente / aguardando envio | `#8A5A00` | `#FFF4E5` | Âmbar |
| Rejeitado / vencido | `#A01B1B` | `#FDECEC` | Vermelho da marca, versão suave |
| Neutro / inativo | `#212529` | `#F0F0F0` | — |

> ⚠️ Status **nunca** só por cor: sempre texto ("Aprovado", "Rejeitado"), e opcionalmente ícone.

---

## 4. Tipografia

**Família única:** [Montserrat](https://fonts.google.com/specimen/Montserrat) (Google Fonts), pesos **400, 500 e 600**.
`font-family: "Montserrat", -apple-system, "Segoe UI", Roboto, sans-serif;`

### 4.1 Escala usada no site

| Papel | Tamanho | Peso | Extras | Exemplo no site |
|---|---|---|---|---|
| Título de seção | 35 px | 600 | line-height 1 | "Oportunidades Exclusivas" |
| Título de bloco | 25 px | 600 | — | "Encontre seu Jota:" |
| Título de card | 22 px | 400–500 | caixa alta nos imóveis | "VISTA DO RIO MAIS VIVER" |
| Título de card de benefício | 19 px | 600 | Capitalize | "Garantia De Qualidade" |
| Corpo | 16 px | 400 | line-height 1,5 | Descrições |
| Link de ação | 16 px | 600 | vermelho `#BD1E1B` + seta → | "Saiba mais →" |
| Botão | 16 px | 400–600 | caixa alta no botão pill | "VER TODAS" |
| Menu | 11 px | 600 | — | "Home", "Blog" |
| Selo | 13–14 px | 400–500 | caixa alta, branco sobre vermelho | "LANÇAMENTO" |

### 4.2 Escala recomendada para o portal
O menu de 11 px do site é pequeno demais para uso diário. No portal:

| Token | Tamanho / peso | Uso |
|---|---|---|
| `text-display` | 32 px / 600 | Título da página de login |
| `text-h1` | 28 px / 600 | Título de página |
| `text-h2` | 22 px / 600 | Título de seção / card |
| `text-h3` | 18 px / 600 | Subtítulo |
| `text-body` | 16 px / 400 | Texto e campos |
| `text-sm` | 14 px / 400–500 | Tabelas, menu lateral, ajuda |
| `text-xs` | 12 px / 500 | Selos, rótulos pequenos, metadados |

---

## 5. Forma, bordas e sombras

| Token | Valor | Uso |
|---|---|---|
| `radius-signature` | `20px 0` | **Assinatura da marca.** Imagens de card, card de destaque, painel de login |
| `radius-card` | `20px` | Cards de informação (como "Porque a Jota?") |
| `radius-pill` | `15px` a `100px` | Botão pill ("VER TODAS"), selos arredondados |
| `radius-control` | `3px` | Botões retangulares e campos de formulário |
| `radius-full` | `50%` | Setas de carrossel, ícones sociais, avatar |
| `border-card` | `1px solid #ACACAC` | Cards |
| `border-field` | `1px solid #666666` | Campos (select/input) |
| `shadow-sm` | `0 1px 4px rgba(0,0,0,.10)` | Elevação leve (card ao passar o mouse) |
| `shadow-lg` | `0 32px 68px rgba(0,0,0,.30)` | Modais |

O site quase não usa sombra: a separação vem de **borda fina + fundo alternado**. Manter isso no portal.

---

## 6. Espaçamento e layout

- **Container:** conteúdo em **1140 px** (máximo 1200 px), centralizado.
- **Espaçamento base 8 px:** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 80.
- **Gap entre blocos:** 24 px. **Padding interno de card:** 35 px vertical / 15 px horizontal nos cards de benefício.
- **Seções** separadas por fundo alternado (`#FFFFFF` ↔ `#F8F8F8`) e ~80 px de respiro vertical.
- **Cabeçalho:** ~106 px de altura, fundo `#F2F2F2`, logo à esquerda, menu no centro, ação à direita ("Espaço do Cliente" com ícone de pessoa).
- **Grade de cards:** 3 colunas no desktop.

---

## 7. Componentes (como estão no site → como usar no portal)

### Botão primário
- Site: fundo `#DF1A1A`, texto branco 16 px, `padding 8px 16px`, raio 3 px ("Pesquisar").
- Variação pill: raio 15 px, `padding 12px 24px`, peso 600, caixa alta ("VER TODAS").
- **Portal:** botão primário retangular (raio 3–4 px) para ações de formulário ("Enviar documento", "Salvar"); o pill fica para CTAs de destaque (ex.: "Acessar" no login). Hover: escurecer para `#BD1E1B`.

### Botão secundário (novo)
- Contorno `1px #DF1A1A`, texto `#BD1E1B`, fundo branco. Para "Cancelar", "Voltar".

### Link de ação
- Texto `#BD1E1B`, peso 600, seguido de seta → ("Saiba mais →"). Usar em "Ver documentos →", "Ver empresa →".

### Campos de formulário
- Rótulo acima do campo (16 px, `#333`), campo branco com borda `1px #666`, raio 3 px, `padding 8px 16px`.
- Exemplo no site: filtros "Estado / Cidade / Progresso da Obra" + botão "Pesquisar" na mesma linha. **Reaproveitar este padrão** para filtros de listas (obra, empresa, status).

### Selo (badge)
- Site: fundo `#D60000`, texto branco em caixa alta 13–14 px, colado no canto superior direito da imagem ("LANÇAMENTO", "EM CONSTRUÇÃO").
- **Portal:** selo de status de documento usando a tabela 3.4 (fundo suave + texto escuro), caixa alta 12 px. O selo vermelho sólido fica reservado para alerta ("PENDENTE URGENTE").

### Título de seção com barra vermelha
- Barra `50 × 6 px` em `#D60000` acima do título, centralizada ("Depoimentos").
- **Portal:** usar a barra à esquerda/acima do título de cada página ou seção (discreta, identifica a marca).

### Card de empreendimento → card de obra
- Imagem com `radius-signature` (20px 0), selo no canto superior direito, localização com ícone de pin em vermelho, título, descrição em `#676767`, metadados com ícones pequenos.
- **Portal:** card de **obra** com nome, cidade/UF (pin vermelho), quantidade de empresas vinculadas e progresso de documentos.

### Card de benefício → card de indicador
- Fundo branco, borda `1px #ACACAC`, raio 20 px, conteúdo centralizado, ícone de linha no topo, título 19 px/600, texto `#676767`.
- **Portal:** cards de resumo no painel ("12 documentos pendentes", "3 empresas com atraso").

### Seção escura
- Fundo `#494949` com textura de imagem, título branco ("Cidades em Atuação").
- **Portal:** evitar em telas de trabalho. Pode ser usado no **painel lateral da tela de login**.

### Navegação
- Site: menu horizontal no topo, item ativo em `#BD1E1B`.
- **Portal (proposta):** menu lateral branco ou `#F2F2F2`, item ativo com texto `#BD1E1B` e barra vermelha de 3 px à esquerda. O menu escuro do projeto anterior não pertence à marca.

### Rodapé
- Logo à esquerda, ícones sociais em círculos vermelhos à direita, linha de links pequenos ("Espaço do Cliente | Área do Corretor | Trabalhe Conosco | Canal de Denúncia | Contato").
- **Portal:** rodapé mínimo com logo + "© Jotanunes Construtora" + link de suporte.

---

## 8. Iconografia e imagens

- **Ícones de linha** (outline), traço fino, cor `#212529`, como nos cards "Porque a Jota?". Sugestão: **Lucide** ou **Phosphor (regular)**.
- Ícones de ação/destaque em vermelho: pin de localização, setas, calendário.
- O site usa Font Awesome nos ícones sociais.
- **Fotos:** pessoas reais sorrindo, obras e entregas de chaves. No portal, fotos só em estados vazios e no login; nunca em telas de tabela.

---

## 9. Tom de voz

| Faça | Evite |
|---|---|
| Frases curtas, diretas, com "você" | Juridiquês, voz passiva |
| Chamar a empresa pelo nome e o sistema de forma próxima | "Prezado usuário" |
| Explicar o próximo passo ("Envie o ASO para liberar o trabalhador") | Mensagens só com código de erro |
| Maiúscula só em siglas e selos | CAIXA ALTA em frases |

Exemplos de copy para o portal:
- Login: **"Acesse o portal de documentos"**. Campo: **"CNPJ"** e **"Senha"**. Botão: **"Acessar"**.
- Primeiro acesso: **"Crie uma nova senha para continuar."**
- E-mail de convite: **"A Jotanunes precisa dos documentos da sua empresa para a obra {obra}. É só clicar no botão abaixo."**
- Estado vazio: **"Nenhum documento pendente. Tudo certo por aqui."**

---

## 10. Tokens CSS (ponto de partida)

```css
@import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&display=swap");

:root {
  /* Marca */
  --jn-red-600: #D60000;   /* selos, destaques, barra de título */
  --jn-red-500: #DF1A1A;   /* fundo de botão primário */
  --jn-red-700: #BD1E1B;   /* texto/link vermelho, hover do botão */
  --jn-navy-800: #152860;  /* acento secundário */

  /* Neutros */
  --jn-gray-900: #212529;
  --jn-gray-800: #333333;
  --jn-gray-700: #494949;
  --jn-gray-600: #54595F;
  --jn-gray-500: #676767;
  --jn-gray-400: #ACACAC;
  --jn-gray-100: #F2F2F2;
  --jn-gray-50:  #F8F8F8;
  --jn-white:    #FFFFFF;

  /* Status */
  --jn-success-fg: #1E7A3A; --jn-success-bg: #E6F4EA;
  --jn-info-fg:    #1A4B8C; --jn-info-bg:    #E8F1FB;
  --jn-warning-fg: #8A5A00; --jn-warning-bg: #FFF4E5;
  --jn-danger-fg:  #A01B1B; --jn-danger-bg:  #FDECEC;

  /* Tipografia */
  --jn-font: "Montserrat", -apple-system, "Segoe UI", Roboto, sans-serif;
  --jn-text-display: 600 32px/1.2 var(--jn-font);
  --jn-text-h1: 600 28px/1.25 var(--jn-font);
  --jn-text-h2: 600 22px/1.3 var(--jn-font);
  --jn-text-h3: 600 18px/1.35 var(--jn-font);
  --jn-text-body: 400 16px/1.5 var(--jn-font);
  --jn-text-sm: 400 14px/1.45 var(--jn-font);
  --jn-text-xs: 500 12px/1.3 var(--jn-font);

  /* Forma */
  --jn-radius-signature: 20px 0;
  --jn-radius-card: 20px;
  --jn-radius-pill: 999px;
  --jn-radius-control: 3px;
  --jn-border-card: 1px solid var(--jn-gray-400);
  --jn-border-field: 1px solid #666666;
  --jn-shadow-sm: 0 1px 4px rgba(0, 0, 0, 0.10);
  --jn-shadow-lg: 0 32px 68px rgba(0, 0, 0, 0.30);

  /* Espaço */
  --jn-space-1: 4px;  --jn-space-2: 8px;  --jn-space-3: 12px; --jn-space-4: 16px;
  --jn-space-5: 24px; --jn-space-6: 32px; --jn-space-7: 48px; --jn-space-8: 80px;
  --jn-container: 1140px;
}
```

---

## 11. Aplicação nas duas partes do sistema

| | **Lado Jotanunes (dentro do Fluig)** | **Portal da terceirizada** |
|---|---|---|
| Contexto | Abre dentro do Fluig, que já tem cabeçalho e login | Página própria, acesso por CNPJ + senha |
| Cabeçalho | **Sem** cabeçalho de marca (evita duplicar o do Fluig); só título da página com a barra vermelha | Cabeçalho `#F2F2F2` com logo, nome da empresa logada e "Sair" |
| Telas-chave | Obras, empresas por obra, tipos de documento, disparo de e-mail de convite, análise de documentos | Login, troca de senha no primeiro acesso, lista de documentos exigidos, upload, status |
| Destaque visual | Tabelas densas, filtros no padrão "Encontre seu Jota" | Cards grandes e claros, poucos passos, `radius-signature` no painel de login |

> ⚠️ **Verificar no Fluig:** se o formulário/widget herda CSS do tema do Fluig. Se herdar, os tokens acima precisam de prefixo/escopo (`.jn-app …`) para não conflitar.

---

## 12. Pendências

- [ ] Pedir à Jotanunes o **logo em SVG** (colorido e branco) e o manual de marca, se existir; conferir se o vermelho oficial é `#D60000`.
- [ ] Confirmar com o Gustavo o fluxo de senha (Jotanunes define vs. troca no primeiro acesso), porque afeta as telas do portal.
- [ ] Validar as cores de status (seção 3.4); são proposta, não vêm do site.
- [ ] Checar as restrições visuais do Fluig para o lado interno.
