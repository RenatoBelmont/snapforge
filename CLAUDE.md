# Snapforge — guia do projeto (para o Claude Code)

Editor de pixel art, tilemap, Pixel Snapper e normal maps, inspirado no Sprite Fusion. HTML/CSS/JS puro, sem dependências em tempo de execução, gerado como **um arquivo HTML único** e como **PWA instalável no iPad**. Versão atual: **1.9.1**.

Dono: Renato (dev indie, estúdio Cosmic Valley). Usa principalmente no **iPad com Apple Pencil** e também no Windows (Chrome/Firefox). Interface 100% em **português do Brasil**.

---

## Regras do projeto (siga sempre)

1. **Versão em toda alteração.** SemVer: PATCH = correção/ajuste; MINOR = recurso novo sem quebrar dados; MAJOR = mudança que quebra o formato salvo (localStorage ou `.json`). A versão vive em **dois lugares e eles precisam bater**: `const VERSION` em `src/shell.html` e `"version"` em `package.json`. Ela aparece no cabeçalho do app e vira a chave do cache do service worker no build. Registre a mudança na seção "Histórico" abaixo.
2. **Visual "portátil"** (escolhido pelo Renato na 1.4.0; tokens e regras em **`DESIGN.md`**): carcaça neutra (cinza-massa no claro, grafite no escuro), teclas com relevo, destaque **ameixa** só para ação/seleção, desenho numa "tela" escura recuada, **só a arte tem cor saturada**, faixa **LCD** com letra de pixel (Silkscreen embutida), **LED** de salvamento. Contraste ≥ 4,5:1 medido nos dois temas. **Ícone próprio** (a bigorna em pixel).
3. **Layout**: cabeçalho numa linha só (marca + versão + abas + LED + tema), **trilho de ferramentas em uma coluna** à esquerda (pedido do Renato; a tecla vai de 44 a 38 px conforme a altura da tela), canvas no centro com a **fileira de paleta** e o **LCD** embaixo, **painel direito em módulos recolhíveis**. **Tudo cabe numa tela, sem rolar a página** — só os painéis internos rolam. Há teste automatizado para isso.
4. **Sem IA / sem APIs pagas / rede só no Lospec.** A geração por IA (Gemini/Groq) foi removida a pedido na 1.2.0; o botão "Prompt para o ChatGPT" no Snapper só monta texto. **Única exceção de rede, liberada pelo Renato na 1.6.0:** "Do Lospec" (módulo Cor) busca `https://lospec.com/palette-list/<slug>.json` **só quando o usuário pede**; a paleta fica salva e o app continua funcionando offline. Não acrescentar outras chamadas de rede sem pedido explícito.
5. **Sem dependências no app**: nada de CDN, frameworks ou fontes externas. Precisa abrir offline e como arquivo único. (Playwright e pngjs são só para build de ícones e testes.)
6. **iPad primeiro**: alvos de toque ≥ 30–44 px, `touch-action` correto, nada de hover obrigatório, `inputmode` em campos numéricos, safe-area. Todo recurso de desenho tem que funcionar com caneta, dedo e mouse.
7. **Não editar `dist/` à mão.** Edite `src/` e rode o build.

---

## Estrutura

```
CLAUDE.md            este guia
README.md            instruções de uso/instalação (sem número de versão; o dist/pwa/README.md é gerado pelo build.js com a versão)
package.json         scripts de build e teste (package-lock.json fixa as versões de Playwright/pngjs)
build.js             gera dist/snapforge.html e dist/pwa/
icons/               PNGs do ícone (versionados; regenerar com `npm run build:icons`)
src/
  shell.html         HTML + todo o CSS + marcadores de build
  engines.js         Pixel Snapper e Sprite Normals (porte JS dos projetos Rust da Sprite Fusion)
  00_base.js … 11_init.js   o app, concatenado em ordem alfabética
  fonts/             Silkscreen (OFL), embutida em base64 no build — sem rede
  tilesets/          Sprout Lands (Basic), de Cup Nooble: 17 PNGs embutidos no build + LICENSE-sprout-lands.txt
tests/
  e2e.js             151 verificações no navegador (Playwright + Chromium)
  engines-vs-rust.js compara os motores JS com os binários Rust originais
  snapper-structure.js  idem, checando grade e cor-base célula a célula
  fixtures/          imagens de teste + make_fixtures.js que as gera
dist/
  snapforge.html     arquivo único (bom no computador)
  pwa/               index.html + sw.js + manifest + icons/  → publicar no GitHub Pages
  pwa-v2/            só redirecionamento + service worker que se desinstala (aposentou a interface de teste da 1.3.0)
DESIGN.md            sistema visual (tokens, componentes, regras)
PRODUCT.md           fatos do produto (usado pelo impeccable)
.claude/             plugin frontend-design (settings.json) e skills ui-ux-pro-max e impeccable
.impeccable/         contrato de direção do design e exceções do detector do impeccable
```

## Build

```bash
npm install                 # só para testes/ícones
npx playwright install chromium
npm run build               # = node build.js
npm test                    # build + tests/e2e.js
```

Se o Chromium já estiver instalado em outro lugar (ex.: ambiente do Claude Code na nuvem), aponte `PW_CHROMIUM=/caminho/do/chrome` em vez de rodar `playwright install`. O teste confere que `#ver` bate com o `version` do `package.json`.

`build.js`:
1. Concatena `src/*.js` (exceto `engines.js`) **em ordem alfabética do nome do arquivo** e injeta em `/*@JS*/` dentro de `src/shell.html`. Por isso os arquivos têm prefixo numérico — **a ordem importa** (veja "Módulos").
2. Injeta `src/engines.js` em `<script id="engines-src">/*ENGINES*/</script>`. O app lê esse texto para criar o Web Worker (Blob URL) e também o executa na página, como fallback.
3. Substitui `__LOGO_SVG__`, `__FAVICON__`, `__APPLEICON__` (PNG em data URI), `__FONT_SILK_400__`/`__FONT_SILK_700__` (woff2 em data URI) e `<!--PWA_HEAD-->` (vazio no arquivo único; manifest + registro do service worker no PWA).
4. Gera `dist/pwa/sw.js` com cache `snapforge-<versão>-<hash>` (rede primeiro, cache offline) e o `manifest.webmanifest`.

O desenho do ícone está na constante `ART` (SVG 10×10) em `build.js`. Se mudar, rode `npm run build:icons`.

## Design

Sistema completo em `DESIGN.md` (tokens em YAML + regras); direção e contrato em `.impeccable/surfaces/src-shell-html.md`; fatos do produto em `PRODUCT.md`. As skills de design ficam no repositório (`.claude/`): **frontend-design**, **ui-ux-pro-max** e **impeccable** (rode `.claude/skills/impeccable/scripts/impeccable detect src/shell.html` depois de mexer no CSS; deve dar 0 problemas). Histórico: a 1.3.0 publicou o design novo ao lado do antigo (visual do Waypoint) para comparação; na 1.4.0 o Renato escolheu o novo e o antigo saiu (continua no histórico do git, commit `3f7fec1`).

## Módulos (`src/`)

Scripts clássicos concatenados, todos no mesmo escopo global (sem `import`/`export`). Um módulo pode usar função de outro definido depois **desde que só chame em tempo de execução** (não no carregamento). Cuidado com `const`/`let` usados antes de declarados durante a inicialização.

| Arquivo | Responsabilidade |
|---|---|
| `00_base.js` | `$`, `$$`, `clamp`, `esc` |
| `01_icons.js` | Ícones SVG de traço (estilo Lucide), `ico(nome)`, `paintIcons()` troca `<i data-ic>` por SVG |
| `02_utils.js` | `toast`, `busy`/`withBusy` (card de carregamento central), `modal`/`confirmar`, leitura de arquivos, `saveBlob` (usa a folha de compartilhar no iPad), `fitImage`, `keyMagenta`, `LS` (localStorage com prefixo `snapforge.` e migração das chaves antigas `pixelaria.`) |
| `03_engine.js` | Worker dos motores (`runEngine('snap'|'normal', img, opts)`) com fallback na thread principal |
| `04_pal.js` | Paletas embutidas (Sweetie 16, PICO-8, Endesga 32, Game Boy, 1-bit + 8 do Lospec com o autor em comentário: RETURN 20, Minty chip, CC-29, Resurrect 64, SLSO8, Lost Century, Twilight 5, CafeArisuki), paletas do usuário, cores recentes |
| `04c_palimport.js` | Importar paletas: `parsePaletteFile` (.hex, .gpl do Lospec/GIMP, .pal JASC e RIFF), `lospecSlug`, `fetchLospecPalette` (única chamada de rede; o 404 do Lospec vem sem CORS, então uma falha testa `pico-8` para separar "nome errado" de "sem internet"), `adoptPalette` (se as cores já forem de uma paleta padrão, só a seleciona) |
| `04b_palpicker.js` | Seletor de paleta **com prévia das cores** (`palettePicker(host, {value, auto, doc, onChange})`) |
| `05_doc.js` | Documento do editor (`doc`: camadas × quadros de `Uint8ClampedArray` RGBA), estado `st`, histórico (`pushHist/undo/redo`, snapshots completos, máx. 80), `composite()` |
| `06_draw_input.js` | Render do canvas (zoom/pan, xadrez, grade, simetria, seleção, prévia do pincel), ferramentas de desenho, **toda a entrada por ponteiro** (Pencil, toque, mouse, gestos, lupa do conta-gotas) |
| `07a_layerops.js` | Espelhar/girar, limpar, contorno automático, copiar/recortar/colar, cortar na seleção, mover com setas |
| `07b_picker.js` | Seletor de cor (quadrado SV + matiz + HEX + Recentes + paleta + Favoritas), com **pointer events** (funciona no toque) |
| `07c_files.js` | Serializar/abrir projeto `.json`, novo, renomear, importar imagem, exportar PNG/sprite sheet |
| `07d_editor_ui.js` | Trilho, barra do palco, cards do painel direito (Cor, Pincel e vista, Camadas, Animação, Canvas), modo foco + faixa de cores, status de salvamento, **atalhos de teclado** |
| `07e_prow.js` | Fileira de paleta embaixo do canvas (`renderPRow`, chamada por `renderFaixa` e `setTool`) e a cor atual no LCD |
| `08_snapper.js` | Lupa sincronizada (`setupLoupe`), tela do Pixel Snapper, prompt para o ChatGPT |
| `09_normal.js` | Tela do Normal Map + prévia de luz interativa |
| `10_tilemap.js` | Editor de tilemap completo (tileset, pincel/carimbo, autotile, camadas, export Tiled/PNG/JSON, ZIP sem compressão) |
| `10a_tilelib.js` | Biblioteca de tilesets prontos (`TILESET_LIB` em listas: Terreno, Terra arada, Construções, Natureza e objetos; `TILESET_FILES` é preenchido pelo build a partir de `src/tilesets/`), `openTilesetLib` (menu "Prontos"), `loadLibTileset` |
| `11_init.js` | Abas, tema, bloqueio de zoom da página no iPad, gravação imediata ao sair, `init()` |

## Dados e persistência

Tudo em `localStorage` (por navegador/aparelho), chaves com prefixo `snapforge.`:

| Chave | Conteúdo |
|---|---|
| `doc` | projeto do editor (mesmo formato do `.snapforge.json`) |
| `tilemap` | mapa + tileset em data URL (mesmo formato do `.tilemap.json`) |
| `palName`, `userPals`, `recentColors` | paletas e cores |
| `penOnly`, `penSeen`, `faixa`, `cards`, `tcards`, `view`, `dark`, `loupe.*`, `s.fit`, `prompt`, `nOpts`, `brush` (1–16), `brushShape` (`round`/`square`), `tBrush` (1–8, pincel do mapa) | preferências de interface |

- **Projeto do editor** (`app: 'snapforge'`, `schema: 2`): `{name, w, h, fps, layers:[{name, visible, opacity, locked}], frames:[[base64 RGBA por camada]], cur, palName}`. A importação aceita também `app: 'pixelaria'` (versões 1.0.x).
- **Mapa** (`app: 'snapforge-tilemap'`, `schema: 2` desde a 1.9.0): `{name, tw, th, mw, mh, tilesets:[{name, url(dataURL), w, h}], ts, layers:[{name, visible, auto, data:[valor|-1], cells?, rules?[16]}]}`. **Valor da célula = tileset × 65536 + tile** (tileset 0 = os números de sempre); `ts` = tileset ativo. O **schema 1** (`tileset:{...}` único, valores = tile) continua sendo lido sem conversão: vira o tileset 0. Só `data:image` é aceito como imagem de tileset.
- O salvamento automático tem *debounce* (600 ms no editor, 500 ms no mapa), mas `flushSaves()` grava na hora em `visibilitychange`/`pagehide`/`beforeunload` — no iPad, trocar de app não dispara `unload`. Se o `localStorage` encher, o status mostra "Não salvo — use Salvar".
- Mudou o formato? Suba o `schema`, mantenha a leitura do antigo e trate como MAJOR se não for compatível.

## Entrada (Apple Pencil, toque, mouse) — invariantes

Herdado do app Ponto Cruz do Renato. Testado e fácil de quebrar; leia antes de mexer em `06_draw_input.js` ou na entrada de `10_tilemap.js`:

- **Modo "Só Pencil"** (`st.penOnly`): liga sozinho na primeira vez que um `pointerType === 'pen'` toca (`st.penSeen` evita religar). Com ele, um dedo só move a vista e dá zoom; caneta pinta. Enquanto a caneta está encostada (`PEN_DOWN`), toques são ignorados (palma).
- **Pinça** com dois dedos = zoom + pan. Se o segundo dedo chega durante um traço feito com o dedo, o traço é **desfeito** (`abortStroke`/`tAbort`, que também devolvem a pilha de refazer). O gesto só é marcado como "movido" (pinça, sem desfazer) se o 1º dedo **já estava desenhando de verdade: > 250 ms ou > 14 px** — os dedos nunca chegam juntos na mão de verdade, e na 1.7.0 marcar sempre impedia o desfazer de 2 dedos com "Dedo pinta" (corrigido na 1.7.1).
- **Toque com 2 dedos = desfazer, 3 = refazer, como no Procreate** (sem mover > 14 px, < 450 ms). **Segurar** 2/3 dedos parados 500 ms desfaz/refaz em sequência, acelerando (`gestArm`/`gestStop` em `02_utils.js`, usados pelo editor e pelo Tilemap). Se o gesto foi toque (não pinça), zoom e posição voltam exatamente ao valor de antes (`VIEW0`/`tView0`). Os testes mandam os dedos com 40 ms de intervalo, como na mão real.
- **Segurar 1 dedo parado 420 ms** = conta-gotas com **lupa** (anel: metade de cima = cor sob o dedo, de baixo = cor atual). Alt+clique faz o mesmo no mouse.
- **Balde no toque só preenche ao soltar** (`fillPend`), para uma pinça que começa não preencher por engano.
- Traços usam `getCoalescedEvents()` (linhas suaves com a Pencil). Pencil com hover (iPad Pro) mostra a prévia do pincel.
- Página: `gesturestart` bloqueado, duplo toque bloqueado (só se `e.cancelable`), `overscroll-behavior: none`, `touch-action` nos canvases.
- Listeners de elementos que **não são recriados** devem ser ligados **uma vez só** (o Waypoint teve bug de listener empilhado a cada re-render). Estado de arraste que sobrevive a re-render fica em variável de módulo (ex.: `tsDrag` no tileset).

## Motores (Pixel Snapper e Sprite Normals)

`src/engines.js` é um **porte linha a linha** dos projetos open source da Sprite Fusion (MIT, © Hugo Duprez):
- https://github.com/Hugo-Dz/spritefusion-pixel-snapper (`src/lib.rs`)
- https://github.com/Hugo-Dz/spritefusion-sprite-normals (`src/*.rs`)

Não foi possível compilar para WebAssembly no ambiente original (download do target `wasm32` bloqueado), por isso o porte em JS. Fidelidade verificada contra os binários Rust nativos:
- Snapper: **saída idêntica byte a byte** (grade e cores), com ou sem paleta fixa. Desde a 1.2.2 o k-means usa um porte exato do `ChaCha8Rng::seed_from_u64(42)` (rand_core 0.6.4 / rand_chacha 0.3.1), do `gen_range` e do `WeightedIndex<f32>` do rand 0.8.5, e emula as contas em f32 do Rust (`Math.fround`/`Float32Array`). As distâncias são calculadas uma vez por cor única — mesmo resultado, 1,5–2,5× mais rápido que o porte anterior. Usa `BigInt` (Safari 14+).
- Normals: diferença máxima de **1/255 por canal** (arredondamento f32 × f64).

Para reverificar: clone os dois repositórios numa pasta `sf-repos/` ao lado do projeto (ou aponte `SF_REPOS`), rode `cargo build --release` em cada um e depois `npm run test:engines` (última verificação: upstream do snapper em `02f9315`, 2026-10-20; Rust 1.97). Mexeu no k-means? Esse teste exige igualdade exata. Se quiser trocar o porte pelo WASM oficial: `rustup target add wasm32-unknown-unknown` + `wasm-pack build --target web` (snapper) / `wasm-bindgen` 0.2.126 (normals), embutir o `.wasm` em base64 e manter a mesma interface de `runEngine`.

## Tilemap

- Tileset: PNG em grade, tile de 8 a 64 px (botões), do editor/Snapper ou da biblioteca **"Prontos"**: os tilesets do **Sprout Lands (Basic), de Cup Nooble** (todos com tile de 16 px), separados em listas. Mapa novo começa com a **Grama**. O antigo tileset de exemplo gerado em código saiu na 1.8.0 (mapas salvos mantêm o tileset que já têm). **Licença do pacote** (`src/tilesets/LICENSE-sprout-lands.txt`): uso **não comercial**, crédito obrigatório a Cup Nooble (está no menu e no README), proibido redistribuir o pacote em si; os dois "Bitmask references" do pacote são diagramas e não foram incluídos.
- **Vários tilesets por mapa** (1.9.0): trocar o tileset (Prontos, Importar, Do editor) só muda com o que se pinta; o que já está no mapa continua igual, porque cada célula guarda de qual tileset veio (`tEnc`, `tsOf`, `tileOf_`; `drawTile` usa `tsImgs[set]`/`tsColsAll[set]`). `tActivate(i)` torna um tileset ativo e tira da lista os que não estão em uso em nenhuma camada (renumerando as células). Com mais de um, o módulo Tileset mostra "Tilesets deste mapa" para voltar a pintar com qualquer um; o conta-gotas do mapa também troca para o tileset do tile pego. Todos usam o mesmo tamanho de tile do mapa. Exportação: no `.tmj` cada tileset vira um `firstgid` em sequência e uma imagem (`tileset-1.png`, `tileset-2.png`…); no JSON simples, `índice = firstIndex do tileset + tile`. **Com um tileset só, os dois arquivos saem exatamente como antes** (`tileset.png`, índices de sempre).
- Ferramentas: carimbo (seleção retangular de vários tiles; toque pinta o bloco, arrastar ladrilha a partir do ponto inicial), borracha, balde, retângulo, conta-gotas de tile, **seleção** (S), mão; modo **aleatório** (sorteia da seleção).
- **Pincel do mapa** (`ts.brush`, 1–8 tiles, quadrado N×N, módulo "Pincel" e teclas `[` `]`): vale para tile único, aleatório, autotile e borracha (`tBrushApplies`/`tPaintAt`); um carimbo de vários tiles usa o próprio tamanho.
- **Seleção no mapa** (`ts.msel`, camada atual): arrastar seleciona; arrastar dentro move o conteúdo (`tShiftSel`, um passo de desfazer; o que sai do mapa se perde, como no editor); toque sem arrastar tira a seleção. Copiar/recortar/colar/apagar (`tCopy`, `tPaste`, `tDeleteSel`) pela barra flutuante ou ⌘C/⌘X/⌘V/Delete, ⌘A seleciona tudo, Esc tira. Colar entre tipos de camada: autotile → normal cola o tile resolvido; normal → autotile vira "tem terreno"; células vazias do recorte não apagam o que está embaixo. `msel` entra nos snapshots do desfazer.
- Ordem do painel: Tileset, **Camadas**, Pincel, Mapa — Camadas logo abaixo do tileset para criar autotile e tocar nas regras sem rolar o painel no iPad.
- **Autotile de 16 combinações** (máscara de 4 vizinhos: cima=1, direita=2, baixo=4, esquerda=8). Cada camada de autotile guarda `cells` (tem terreno ou não) e `rules[16]` (tile de cada máscara); falta de regra cai em `rules[15]`. As regras são atribuídas tocando no quadrado e depois no tile, **no mesmo card do tileset**, em **8 quadrados por linha** (para tileset e regras caberem juntos na tela do iPad sem rolar o painel; com 4 por linha e um tileset grande, o tileset saía da tela).
- Exporta: **Tiled `.tmj`** (gid = índice + 1, 0 = vazio; vem num `.zip` com `tileset.png`, ZIP sem compressão feito à mão em `zipStore`), PNG e JSON simples. Camadas de autotile saem resolvidas.
- Redimensionar o mapa ancora no canto superior esquerdo (corta o resto; ⌘Z desfaz).

## Testes

`npm test` roda o build e `tests/e2e.js` (Chromium, viewport de iPad 1180×820 com toque). Cobre: desenho com mouse, **Pencil e toque via CDP** (`Input.dispatchMouseEvent` com `pointerType: 'pen'` e `Input.dispatchTouchEvent`), gestos, lupa, camadas (travar, arrastar), seleção/copiar/colar/setas, seletor de cor, seletor de paleta, botões de tamanho, modo foco + faixa, salvar/recarregar, Snapper (card de carregamento, lupa sincronizada, tamanho final, prompt), Normal Map, Tilemap inteiro (carimbo, balde, autotile, export `.tmj` validado), ausência de chamadas de IA, e **"sem rolar a página" em 4 abas × 3 tamanhos de tela** (mais: barra do palco numa linha só) e um bloco de regressão da 1.2.1 (camada vinda do Snapper, histórico/seleção, balde do tilemap no toque, tileset só `data:image`, desfazer de tileset, modal de novo mapa). Capturas vão para `tests/screenshots/` (ignorado no git).

Não coberto: **Safari/WebKit de verdade** (o comportamento do iPad foi simulado no Chromium). Se instalar o WebKit do Playwright (`npx playwright install webkit`), vale rodar o e2e nele também.

## Publicar no iPad

O GitHub Pages publica **a raiz da branch** (Settings → Pages → Deploy from a branch → `/ (root)`). Na raiz há um `index.html` que só redireciona para `dist/pwa/` e um `.nojekyll` (sem ele o Jekyll processaria o repositório). Endereço: **https://renatobelmont.github.io/snapforge/** → abre `…/snapforge/dist/pwa/`. Como `dist/` é versionado, **todo push com o build feito já publica** — rode `npm run build` antes de commitar.

No iPad: abrir no Safari → Compartilhar → Adicionar à Tela de Início. O service worker troca a versão sozinho a cada build (cache `snapforge-*`, não mexe nos caches de outros apps do mesmo domínio `github.io`). Um HTML solto aberto pelo app Arquivos do iPad não roda bem — por isso o PWA. Ao juntar a branch na `main`, troque a branch em Settings → Pages.

## Histórico

- **1.9.1** — ícone de **importar** (seta entrando na caixa, `ico('import')`) em "Importar PNG" do Tilemap (usava a seta de envio, para fora) e em "Do Lospec" (usava o mesmo ícone de Exportar). Regra: `import` = trazer para dentro do app; `download` = exportar/baixar.
- **1.9.0** — **vários tilesets no mesmo mapa**: antes o mapa tinha um tileset só e trocá-lo redesenhava tudo o que já estava pintado com o tileset novo. Agora cada célula lembra de qual tileset veio (schema 2 do mapa; o schema 1 continua abrindo igual); lista "Tilesets deste mapa"; conta-gotas troca de tileset; export Tiled com vários tilesets. 151 verificações.
- **1.8.0** — **Tilesets do Sprout Lands** (Cup Nooble) no Tilemap, em listas, no lugar do tileset de exemplo; Grama como padrão. Ajustes pedidos no iPad: **bigorna** sobre uma placa escura (sumia no tema claro); barra de comandos com espaço menor entre botões e o **nome do projeto encolhendo com "…"** para o botão de tela cheia nunca ser cortado (editor e Tilemap iguais); **xadrez do fundo do Tilemap preso ao mapa** (antes as casas tinham 16 px fixos de tela e escorregavam no zoom); módulo **Canvas em 2º** no painel; "Manter desenho/Redimensionar" como chips sem quebra de palavra (`white-space:nowrap` em chips e segmentados); **ícones dos botões dos módulos não giram mais** ao recolher (o seletor `.card-h svg:last-child` pegava os ícones das ações; agora `.card-h > svg:last-child`); regras de autotile em 8 por linha. 144 verificações.
- **1.7.1** — **toques com 2/3 dedos como no Procreate**: com "Dedo pinta" o toque de dois dedos não desfazia (o 1º dedo, que chega antes, começava um traço e o gesto era tratado como pinça); agora só vira pinça se o 1º dedo já desenhava há > 250 ms ou > 14 px. Segurar 2/3 dedos desfaz/refaz em sequência, acelerando; o toque não mexe mais no zoom. No Tilemap, começar um traço apagava a pilha de refazer mesmo quando o traço era cancelado ou não mudava nada (corrigido como no editor). 135 verificações.
- **1.7.0** — Tilemap: **ferramenta de seleção** (arrastar seleciona, arrastar dentro move, copiar/recortar/colar/apagar, ⌘A, Esc, tudo com desfazer) e **tamanho de pincel** 1–8 tiles. **Barra de seleção flutuante** sobre a tela, no editor e no mapa (antes ficava na barra de comandos e, com seleção ativa, a do editor transbordava 162 px e escondia zoom/tela cheia). Seleção, cursor e grade maior desenhados em **ameixa** (`cssRgb('--plum')`), não mais no âmbar antigo. Painel do mapa reordenado (Camadas logo abaixo do tileset). 128 verificações.
- **1.6.0** — **importar paletas**: "Do Lospec" (link ou nome; exceção de rede da regra 4, liberada pelo Renato) e "Arquivo" (.hex, .gpl, .pal JASC/RIFF, offline; seletor sem filtro de extensão porque o Safari do iPad deixa cinza .gpl/.pal). **Pincéis**: tamanhos 1, 2, 3, 4, 5, 6, 8, 10, 12 e 16 px (botões e teclas `[` `]`), formato redondo ou quadrado em qualquer tamanho (antes os pares eram sempre quadrados), ambos salvos no aparelho. Testes com o Lospec simulado (115 verificações).
- **1.5.0** — 8 paletas do Lospec embutidas (RETURN 20, Minty chip, CC-29, Resurrect 64, SLSO8, Lost Century, Twilight 5, CafeArisuki), conferidas cor a cor com o JSON oficial e com os nomes/autores de lá. Avaliada a API do Lospec (ver Backlog).
- **1.4.0** — **design "portátil" vira o oficial** (escolha do Renato após comparar na 1.3.0): `src/v2/shell.html` → `src/shell.html`, fileira de paleta/LCD integrados ao app (`07e_prow.js`, sem os encaixes provisórios), `DESIGN.md` na raiz, regras 2–3 atualizadas, build com uma interface só. `dist/pwa-v2/` virou redirecionamento para `dist/pwa/` com um service worker que limpa o cache e se desinstala (para quem instalou o "Snapforge 2").
- **1.3.0** — **interface nova em comparação** (`src/v2/`, `dist/pwa-v2/`), feita com as skills de design instaladas no repositório (frontend-design, ui-ux-pro-max, impeccable): mundo "portátil", trilho em uma coluna, fileira de paleta, faixa LCD, LED de salvamento, contraste medido ≥ 4,5:1 nos dois temas; a bateria e2e roda nas duas interfaces. Na atual nada muda além da versão (e o texto vazio do Snapper agora segue o nome do botão).
- **1.2.4** — correção de verdade do balde do Tilemap: `tFill` agora diz se mudou algo e o traço é marcado como alterado — antes o `tEnd` achava que nada mudou, não redesenhava o mapa **e descartava o passo de desfazer** (o balde nunca foi desfazível). Teste e2e reproduz a sequência relatada (balde → tile → mapa) com o mapa já redesenhado.
- **1.2.3** — (tentativa incompleta) correção: o balde do Tilemap preenchia os dados mas a tela só atualizava na ação seguinte (faltava marcar o mapa para redesenhar; bug vindo da 1.2.0). Teste e2e agora confere o desenho, não só os dados.
- **1.2.2** — Pixel Snapper **idêntico ao Rust** também nas cores do k-means (ChaCha8 + `gen_range` + `WeightedIndex` portados, contas em f32), e mais rápido (cálculo por cor única); `test:engines` passa a exigir igualdade byte a byte e cobre 4–64 cores; GitHub Pages configurado (redirecionamento na raiz + `.nojekyll`).
- **1.2.1** — auditoria geral. **Correções:** "Adicionar como camada" no Snapper e no Normal Map quebrava (`addImageAsLayer` não existia); "Novo mapa" ignorava o tamanho escolhido (chips sem ação); fazer uma seleção apagava a pilha de refazer e avisava "camada travada"; balde/traço sem efeito criava passo de desfazer vazio e apagava o refazer; abrir JSON inválido comia um passo do desfazer; seletor de paleta se acumulava na memória a cada troca de cor; balde do tilemap no toque preenchia ao encostar (agora só ao soltar, como no editor); tileset de `.tilemap.json` aceitava qualquer URL (agora só `data:image`, sem rede) e uma imagem quebrada travava o painel; trocar tileset/tamanho do tile e abrir mapa agora entram no desfazer sem misturar estados; mesclar camadas respeita a trava; projeto aberto volta com a sua paleta; histórico do editor também limitado por memória (~160 MB). **Design:** barra do palco sempre numa linha (rótulos somem quando aperta; em retrato saem os botões ± de zoom), ícones distintos para Abrir (pasta) e Salvar (disquete), Snapper/Normal em retrato com os cards de ajuste lado a lado (o botão Aplicar aparece sem rolar), anel de foco para teclado, alvos de toque maiores (Recentes, cores do seletor, apagar paleta), `prefers-reduced-motion`, títulos nos botões de zoom do tilemap. Removido código morto (`renderBar`, `trimAlpha`, `b64ToImage`, `fillPalSelect`, `st.panel`).
- **1.2.0** — volta ao layout da v1 (cabeçalho numa linha, painel direito em cards, tela única sem rolagem); **IA removida** (Gemini/Groq); aba **Tilemap**; **lupa** sincronizada no Snapper e Normal Map; **card de carregamento** central; seletor de paleta **com prévia**; botões de tamanho 16–128 (canvas, Snapper, mapa, prompt); salvamento imediato ao sair do app; correções: botões de modal sem estilo, seleção múltipla no tileset, carimbo de bloco, regras de autotile ao lado do tileset.
- **1.1.0** — visual do Waypoint aplicado; recursos de iPad do Ponto Cruz (Só Pencil, gestos, lupa, balde no soltar, faixa de cores); pixel perfeito, copiar/colar seleção, camadas com trava/arrastar/mesclar, seletor de cor com toque, PWA; IA via Gemini + Groq (removida na 1.2.0).
- **1.0.1** — renomeado de Pixelaria para **Snapforge** (o nome Pixelaria já existia e é parecido com o Pixelorama); ícone de bigorna; migração das chaves `pixelaria.*`.
- **1.0.0** — primeira versão: editor (camadas, quadros, paletas), Pixel Snapper e Normal Map portados do Sprite Fusion, geração via API da OpenAI.

## Backlog / ideias não feitas

- Autotile no padrão de **47 peças** (blob) para tilesets prontos nesse layout.
- Exportar direto para **cena do Godot (.tscn/TileSet)** e **Unity Tilemap** (hoje: via Tiled).
- Tilemap: atributos/colisão por tile (o Sprite Fusion tem "Attributes"), mapa infinito, redimensionar com âncora.
- Exportar **GIF** da animação.
- Navegar/buscar no catálogo do Lospec de dentro do app: o endpoint de listagem (`/palette-list/load?...`) não tem CORS, então só com um servidor no meio (hoje a importação é por link ou nome).
- Pressão da Pencil (ex.: tamanho do pincel) — hoje é ignorada de propósito.
- Projetos grandes podem estourar o `localStorage` (~5 MB): migrar para IndexedDB se acontecer.
- Rodar a bateria de testes no WebKit.
