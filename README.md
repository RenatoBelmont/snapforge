# Snapforge — pixel art, sprites e tilemaps

Editor de pixel art com camadas e animação, editor de tilemap com autotile (exporta para o Tiled), Pixel Snapper e normal maps. HTML, CSS e JS puro, num arquivo só, sem dependências. Funciona offline.

## Instalar no iPad

1. Publique esta pasta (GitHub Pages ou Vercel) e abra o link no **Safari**.
2. Toque em **Compartilhar → Adicionar à Tela de Início**.
3. Abra pelo ícone: o app ocupa a tela inteira e funciona sem internet depois da primeira abertura.

Os projetos ficam salvos no próprio iPad. Use **Arquivo › Salvar projeto** de vez em quando como cópia de segurança.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | O app pronto (gerado pelo build — não edite à mão) |
| `sw.js` | Service worker (modo offline); a versão do cache muda a cada build |
| `manifest.webmanifest`, `icons/` | Ícone e dados do app instalado |

## Créditos

Pixel Snapper e Sprite Normals: portes para JavaScript dos projetos open source da Sprite Fusion (MIT, © Hugo Duprez) — https://github.com/Hugo-Dz/spritefusion-pixel-snapper e https://github.com/Hugo-Dz/spritefusion-sprite-normals

Paletas do [Lospec](https://lospec.com/palette-list): RETURN 20 (Patchy Moon), Minty chip (Meson), CC-29 (Alpha6), Resurrect 64 (Kerrie Lake), SLSO8 (Luis Miguel Maldonado), Lost Century (SurrealEmber), Twilight 5 (Star) e CafeArisuki (Arisuki).

Tilesets do Tilemap: Assets - From: **Sprout Lands** - By: **Cup Nooble** (https://cupnooble.itch.io/sprout-lands-asset-pack). Licença do pacote em `src/tilesets/LICENSE-sprout-lands.txt`: uso não comercial, crédito obrigatório, o pacote em si não pode ser redistribuído.

Fonte de pixel: Silkscreen (SIL Open Font License, `src/fonts/OFL.txt`).
