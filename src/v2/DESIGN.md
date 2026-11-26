---
name: Snapforge — interface nova ("portátil")
description: A carcaça do aparelho onde os sprites moram; só a arte tem cor saturada.
colors:
  case-light: "#dcd8cf"
  case-hi-light: "#e9e6df"
  case-lo-light: "#c8c3b9"
  edge-light: "#b2aca1"
  bezel-light: "#3a3944"
  ink-light: "#27242c"
  ink-2-light: "#544e5a"
  ink-3-light: "#5c5662"
  plum-light: "#7b2d5e"
  plum-hi-light: "#923a71"
  case-dark: "#222128"
  case-hi-dark: "#2c2a33"
  case-lo-dark: "#1a191f"
  edge-dark: "#3e3b47"
  bezel-dark: "#0f0e13"
  ink-dark: "#ece9f0"
  ink-2-dark: "#b8b2c0"
  ink-3-dark: "#96909e"
  plum-dark: "#cd68a6"
  plum-hi-dark: "#dd84ba"
  lcd-light: "#8e9b5a"
  lcd-ink-light: "#212a0c"
  lcd-dark: "#3a4419"
  lcd-ink-dark: "#cee080"
  led-ok: "#2fa854"
  led-busy: "#e09600"
  led-err: "#d63840"
  area-editor: "#8b6cf0"
  area-tile: "#e0558a"
  area-snap: "#2f8fe0"
  area-normal: "#1ea476"
typography:
  ui:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', system-ui, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  ui-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 650
  pixel:
    fontFamily: "Silkscreen (embutida), ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
  wordmark:
    fontFamily: "Silkscreen (embutida)"
    fontSize: "15px"
    fontWeight: 700
rounded:
  sm: "7px"
  key: "10px"
  module: "14px"
  well: "16px"
spacing:
  gutter: "10px"
  module-pad: "14px"
  key-gap: "6px"
components:
  key:
    backgroundColor: "{colors.case-hi-light}"
    textColor: "{colors.ink-light}"
    rounded: "{rounded.key}"
    height: "38px"
  key-primary:
    backgroundColor: "{colors.plum-light}"
    textColor: "#fff7fc"
    rounded: "{rounded.key}"
    height: "38px"
  tool-key:
    rounded: "11px"
    size: "38–44px (acompanha a altura da tela)"
  tool-key-active:
    backgroundColor: "{colors.plum-light}"
    textColor: "#fff7fc"
  lcd-strip:
    backgroundColor: "{colors.lcd-light}"
    textColor: "{colors.lcd-ink-light}"
    typography: "{typography.pixel}"
    rounded: "9px"
    height: "30px"
  palette-key:
    rounded: "8px"
    size: "34px"
---

# Design System: Snapforge — interface nova

Vale **só para `src/v2/`** (a cópia em comparação). A interface atual segue o visual do Waypoint descrito no CLAUDE.md. Se a nova for escolhida, este arquivo sobe para a raiz e o CLAUDE.md é atualizado.

## Overview

O Snapforge é o aparelho portátil onde os sprites moram. A interface é a **carcaça**: plástico neutro (cinza-massa no claro, grafite no escuro), teclas com relevo e uma **tela** escura recuada onde fica o desenho. A arte é a única coisa com cor saturada. O estado do documento aparece numa **faixa de LCD** verde-oliva com letra de pixel, e o salvamento é um **LED**. Modo Operate: quem usa editores de pixel art acha tudo onde espera; o mundo entra só por tipo, paleta, densidade e um gesto de assinatura (o LCD).

## Colors

Estratégia **contida**: neutros da carcaça + um acento (ameixa) para ação e seleção. As cores das quatro áreas aparecem só como etiqueta quadrada nas abas e nos módulos.

### Primary
- **Ameixa** (`plum`): botão principal (A), ferramenta ativa, seleção, foco, controles de formulário. Nunca como fundo de área grande.

### Neutral
- **Carcaça** (`case`): fundo do app e cabeçalho. **Relevo** (`case-hi`): painéis, trilho, teclas. **Rebaixado** (`case-lo`): canaletas (abas, segmentados), campos. **Contorno** (`edge`): filetes e bordas de tecla.
- **Moldura da tela** (`bezel`): fundo do canvas e das imagens do Snapper/Normal; escura nos dois temas para a arte saltar.

### Tertiary
- **LCD** (`lcd`, `lcd-ink`): só a faixa de status, as etiquetas das telas, o toast e o carregamento.
- **LEDs** (`led-*`): status de salvamento (verde salvo, âmbar piscando salvando, vermelho não salvo — fica aceso até ser resolvido).

### Named Rules
- **Só a arte tem cor.** Nada de gradiente, brilho ou cor decorativa na carcaça.
- **Contraste medido.** Texto ≥ 4,5:1 nos dois temas (rótulos `ink-3` incluídos). No LCD claro a hierarquia é de peso (rótulo fino, valor em negrito), porque um tom "apagado" não passaria de 4,5:1.

## Typography

- **UI**: fonte do sistema (SF no iPad, Segoe no Windows), 14 px base, rótulos 12,5–13,5 px em 600–750. Números tabulares em todo o app.
- **Pixel** (Silkscreen, OFL, embutida em base64 — sem rede): marca, faixa LCD, etiquetas das telas, legendas de atalho nas teclas, toast. Mínimo 11 px.
- Nada de rótulos em caixa alta inventados; a Silkscreen é só maiúscula por natureza e fica restrita às leituras de "aparelho".

## Layout

- Cabeçalho de 52 px (marca, abas-cartucho, LED, tema).
- **Trilho em uma coluna** (pedido explícito): 16 teclas uma abaixo da outra; o tamanho da tecla acompanha a altura (44 px; 40 px até 860 px de altura; 38 px até 780 px) para caber sem rolar até em 1280×720.
- Centro: barra de comandos → tela (canvas) → **fileira de paleta** (cor atual, borracha, cores da paleta) → faixa LCD.
- Painel direito único (304 px; 268 px abaixo de 1100 px; 252/240 px em pé), dividido em módulos por filetes, cabeçalhos fixos ao rolar.
- Snapper/Normal: ajustes à esquerda, resultado em "telas"; em pé, os módulos de ajuste ficam lado a lado em cima.
- Barra de comandos sempre numa linha: rótulos somem abaixo de 1000 px de largura do palco; abaixo de 660 px saem os ± de zoom e o botão Só Pencil (continua no painel Pincel); abaixo de 470 px o nome do projeto encolhe.
- Tudo cabe numa tela, sem rolar a página (testado em 7 tamanhos).

## Elevation & Depth

Três níveis físicos: **rebaixado** (sombra interna curta), **plano** e **relevo** (borda inferior 2 px + sombra 0 1px 2px). A tela do desenho é o único recuo profundo (sombra interna 0 2px 10px). Popovers e modais: 0 18–24px 44–60px de desfoque, com deslocamento.

## Shapes

Cantos generosos e consistentes por hierarquia: 7 px (miúdos), 8–10 px (teclas, campos), 14 px (módulos), 16 px (tela). Etiquetas de área quadradas (2 px), não bolinhas.

## Components

### Buttons (teclas)
Relevo com borda inferior mais funda; ao apertar descem 1 px (90 ms). Principal em ameixa. Desativado a 42% sem sombra.
### Ferramentas
Teclas do trilho; ativa em ameixa com sombra curta e a letra do atalho em pixel no canto.
### Chips / segmentado
Canaleta rebaixada; o segmento ativo sobe com filete ameixa embaixo. Chips de tamanho viram ameixa quando ativos.
### Paleta (fileira e painel)
Botões de cor 34 px; o ativo sobe 3 px com anel ameixa.
### Inputs
Campo rebaixado; foco com borda ameixa e halo 3 px.
### LCD / toast / carregamento
Mesma superfície de LCD com letra de pixel. Ao abrir o app, a faixa "acende" uma vez (0,7 s em degraus; desligado com movimento reduzido).

## Do's and Don'ts

- **Faça:** manter os IDs que o JS usa; testar com `npm run test:v2`; medir contraste nos dois temas.
- **Não faça:** colorir a carcaça, tingir o canvas (as cores da arte têm que ser fiéis), esconder ferramentas atrás de menus, usar brilho/halo colorido, fonte externa por rede.
