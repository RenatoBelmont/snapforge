# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Renato, dev indie do estúdio Cosmic Valley, fazendo os assets dos próprios jogos. Usa no iPad com Apple Pencil (deitado e em pé) e no Windows com mouse e teclado, com peso igual entre os dois. Sessões longas de desenho de sprites, tiles e mapas, alternando entre criar à mão, limpar imagens geradas no ChatGPT e preparar arquivos para a engine.

## Product Purpose

Editor de pixel art completo que roda offline num arquivo só: editor com camadas e animação, tilemap com autotile e exportação para o Tiled, Pixel Snapper (encaixa imagens de IA numa grade de pixels de verdade) e gerador de normal maps. Sucesso é sair do Snapforge com o asset pronto para a engine sem trocar de app.

## Positioning

Os motores do Sprite Fusion (Pixel Snapper e Sprite Normals) portados para JS com saída idêntica ao Rust original, juntos de um editor e de um tilemap pensados para a Apple Pencil, sem servidor, sem conta e sem IA paga.

## Operating Context

- iPad como PWA na tela de início; Windows no Chrome/Firefox/Vivaldi.
- Pencil desenha; dedo move, dá zoom, desfaz (2 dedos) e refaz (3 dedos); segurar o dedo abre o conta-gotas com lupa.
- Fluxo comum: prompt para o ChatGPT → imagem gerada → Pixel Snapper → editor ou tileset → tilemap → exportar (PNG, sprite sheet, Tiled .tmj, normal map).

## Capabilities and Constraints

- Cinco áreas: Editor, Tilemap, Pixel Snapper, Normal Map e VFX (efeitos animados gerados por código, que viram animação no editor).
- HTML/CSS/JS puro, sem dependências, CDN ou fontes externas; abre offline e como arquivo único.
- Sem IA (o "Prompt para o ChatGPT" só monta texto). Única chamada de rede: importar paleta do Lospec, só quando o usuário pede; todo o resto funciona offline.
- Dados em localStorage (`snapforge.*`); formatos `.snapforge.json` e `.tilemap.json` não podem quebrar.
- Tudo cabe numa tela, sem rolar a página; só os painéis internos rolam.
- Alvos de toque ≥ 30–44 px, nada que dependa de hover, temas claro e escuro.
- Interface 100% em português do Brasil.
- Ferramentas frequentes ficam sempre visíveis (nada escondido atrás de menus ou gestos secretos).

## Brand Commitments

- Nome Snapforge e o ícone da bigorna em pixel (não usar o logo do Waypoint).
- Tom de voz direto, em português, verbos simples.

## Evidence on Hand

- O app atual (`src/`, `dist/`), capturas em `tests/screenshots/`, imagens de teste em `tests/fixtures/`.
- Não há depoimentos, métricas ou usuários além do próprio dono.

## Product Principles

1. O desenho é o protagonista: a interface nunca compete com a pixel art.
2. Caneta, dedo e mouse são cidadãos de primeira classe.
3. Ferramentas frequentes sempre à vista; o raro pode ficar a um toque.
4. Claro e escuro igualmente bem resolvidos.
5. Nunca perder trabalho: salvar sozinho, desfazer em tudo.

## Accessibility & Inclusion

Contraste legível nos dois temas, foco visível para teclado, `prefers-reduced-motion` respeitado.
