/* ======================= tilesets prontos: Sprout Lands (Basic), de Cup Nooble ======================= */
// As imagens ficam em src/tilesets/ e o build.js as embute aqui em data URL (o app continua offline e em arquivo único).
// Licença do pacote em src/tilesets/LICENSE-sprout-lands.txt: uso não comercial, crédito obrigatório (Cup Nooble),
// não redistribuir o pacote em si. Os "Bitmask references" do pacote são diagramas, não tiles, e ficaram de fora.
const TILESET_FILES = /*@TILESETS*/{};
const TILESET_CREDIT = 'Sprout Lands (Basic) · Cup Nooble';
const TILESET_LIB = [
  { group: 'Terreno', items: [['Grama', 'Grass.png'], ['Morros', 'Hills.png'], ['Água', 'Water.png'], ['Caminhos', 'Paths.png']] },
  { group: 'Terra arada', items: [['Terra arada', 'Tilled_Dirt.png'], ['Terra arada v2', 'Tilled_Dirt_v2.png'], ['Terra arada larga', 'Tilled_Dirt_Wide.png'], ['Terra arada larga v2', 'Tilled_Dirt_Wide_v2.png'], ['Terra arada em blocos', 'Tilled Dirt.png']] },
  { group: 'Construções', items: [['Casa de madeira', 'Wooden House.png'], ['Telhado', 'Wooden_House_Roof_Tilset.png'], ['Paredes', 'Wooden_House_Walls_Tilset.png'], ['Portas', 'Doors.png'], ['Cercas', 'Fences.png'], ['Ponte de madeira', 'Wood Bridge.png']] },
  { group: 'Natureza e objetos', items: [['Itens do bioma de grama', 'Basic_Grass_Biom_things.png'], ['Plantas e sementes', 'Basic_Plants.png']] },
];
const TILESET_DEFAULT = ['Grama', 'Grass.png'];
const libTilesetName = (name) => 'Sprout Lands · ' + name;

/** Data URL → imagem RGBA ({ width, height, data }), o formato que setTileset recebe. */
function urlToImage(url) {
  return new Promise((res, rej) => { const im = new Image();
    im.onload = () => { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0); res({ width: c.width, height: c.height, data: x.getImageData(0, 0, c.width, c.height).data }); };
    im.onerror = () => rej(new Error('Não consegui abrir esse tileset')); im.src = url; });
}
/** Troca o tileset do mapa por um da biblioteca (entra no desfazer, como importar um PNG). Todos os do pacote usam tiles de 16 px. */
async function loadLibTileset(file, name) {
  const url = TILESET_FILES[file]; if (!url) return toast('Tileset não encontrado');
  try { setTileset(await urlToImage(url), libTilesetName(name), 16); } catch (e) { toast(e.message); }
}

/** Menu dos tilesets prontos, separado por listas, com a imagem de cada um (mesmo visual do seletor de paleta). */
function openTilesetLib(anchor) {
  if (ppOpen) { closePP(); return; }
  const r = anchor.getBoundingClientRect(), pop = document.createElement('div'); pop.className = 'pp-pop ts-lib'; ppOpen = pop;
  const cur = tm.tileset && tm.tileset.name;
  pop.innerHTML = TILESET_LIB.map(g => `<div class="pp-group">${esc(g.group)}</div>` + g.items.map(([name, file]) => {
    const on = cur === libTilesetName(name);
    return `<div class="pp-item${on ? ' on' : ''}" data-tsf="${esc(file)}" data-tsn="${esc(name)}" role="button" tabindex="0"><span class="h">${esc(name)}</span><img class="px" alt="" src="${TILESET_FILES[file] || ''}"></div>`;
  }).join('')).join('') + `<div class="pp-credit">${esc(TILESET_CREDIT)} · uso não comercial, com crédito</div>`;
  document.body.appendChild(pop); const w = Math.max(r.width, 300); pop.style.width = w + 'px'; pop.style.left = clamp(r.left, 8, innerWidth - w - 8) + 'px';
  const below = innerHeight - r.bottom; if (below < 300 && r.top > below) { pop.style.bottom = (innerHeight - r.top + 4) + 'px'; pop.style.maxHeight = (r.top - 12) + 'px'; } else { pop.style.top = (r.bottom + 4) + 'px'; pop.style.maxHeight = (below - 12) + 'px'; }
  pop.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  pop.addEventListener('click', (e) => { const it = e.target.closest('[data-tsf]'); if (!it) return; closePP(); loadLibTileset(it.dataset.tsf, it.dataset.tsn); });
}
