/* ======================================================================
   TILEMAP — tileset, pincel de tiles (com seleção múltipla e aleatório), camadas normais e de autotile,
   exportação PNG / Tiled (.tmj) / JSON. Mesmos gestos do editor (Pencil, pinça, 2/3 dedos).
   ====================================================================== */
const TT = [['stamp', 'stamp', 'Pincel de tiles', 'B'], ['erase', 'eraser', 'Borracha', 'E'], ['fill', 'bucket', 'Balde', 'G'], ['rect', 'rect', 'Retângulo', 'U'], ['pick', 'pipette', 'Pegar tile do mapa', 'I'], '|', ['select', 'select', 'Seleção: arraste para selecionar, arraste dentro para mover', 'S'], ['hand', 'hand', 'Mão (navegar)', 'H']];
const T_BRUSHES = [1, 2, 3, 4, 5, 6, 8]; // pincel do mapa, em tiles (N×N)
const TILE_SIZES = [8, 12, 16, 24, 32, 48, 64];
let tm = null, tsImg = null, tsCols = 0, tsRows = 0, tsDrag = null;
// sel = tiles escolhidos no tileset; msel = área selecionada no mapa (ferramenta Seleção); brush = lado do pincel em tiles
const ts = { tool: 'stamp', sel: { x: 0, y: 0, w: 1, h: 1 }, random: false, zoom: 2, ox: 0, oy: 0, grid: true, layer: 0, slot: -1, msel: null, brush: clamp(LS.get('tBrush', 1) | 0, 1, 8) };
let tClip = null; // área copiada do mapa: { w, h, auto, vals, tiles }
const tHist = [], tFuture = [];
const tcv = $('#tcv'), tcx = tcv.getContext('2d'), tArea = $('#tArea'), mapOff = document.createElement('canvas');
let mapDirty = true;
function newMap(mw, mh, tw, th, name) {
  const keepTs = tm && tm.tileset; tm = { name: name || 'Mapa', tw: tw || (tm ? tm.tw : 16), th: th || (tm ? tm.th : 16), mw, mh, tileset: keepTs || null, layers: [] };
  addTLayer(false, 'Chão', true); tHist.length = 0; tFuture.length = 0; ts.layer = 0; mapDirty = true;
}
function addTLayer(auto, name, silent) {
  if (!silent) tPush();
  const L = { name: name || (auto ? 'Autotile ' : 'Camada ') + (tm.layers.length + 1), visible: true, auto: !!auto, data: new Int32Array(tm.mw * tm.mh).fill(-1) };
  if (auto) { L.cells = new Uint8Array(tm.mw * tm.mh); L.rules = new Array(16).fill(-1); }
  tm.layers.splice(ts.layer + (tm.layers.length ? 1 : 0), 0, L); ts.layer = tm.layers.indexOf(L); mapDirty = true;
  if (!silent) { renderTSide(); tRender(); tSave(); }
}
const tSnap = () => ({ name: tm.name, tileset: tm.tileset, mw: tm.mw, mh: tm.mh, tw: tm.tw, th: tm.th, layer: ts.layer, msel: ts.msel && { ...ts.msel }, layers: tm.layers.map(L => ({ ...L, data: new Int32Array(L.data), cells: L.cells && new Uint8Array(L.cells), rules: L.rules && L.rules.slice() })) });
const tRestore = (s) => { const reload = s.tileset !== tm.tileset || s.tw !== tm.tw || s.th !== tm.th; Object.assign(tm, { name: s.name, tileset: s.tileset, mw: s.mw, mh: s.mh, tw: s.tw, th: s.th }); if (reload) loadTsImage(() => { renderTSide(); tRender(); }); tm.layers = s.layers.map(L => ({ ...L, data: new Int32Array(L.data), cells: L.cells && new Uint8Array(L.cells), rules: L.rules && L.rules.slice() })); ts.layer = clamp(s.layer, 0, tm.layers.length - 1); ts.msel = s.msel ? { ...s.msel } : null; mapDirty = true; if (typeof renderTSelBar === 'function') renderTSelBar(); };
/** Guarda o estado atual. Devolve a pilha de refazer descartada, para o traço que não mudar nada (ou for cancelado) devolvê-la. */
function tPush() { tHist.push(tSnap()); if (tHist.length > 60) tHist.shift(); return tFuture.splice(0); }
function tUndo() { if (!tHist.length) return toast('Nada para desfazer'); tFuture.push(tSnap()); tRestore(tHist.pop()); renderTSide(); tRender(); tSave(); }
function tRedo() { if (!tFuture.length) return toast('Nada para refazer'); tHist.push(tSnap()); tRestore(tFuture.pop()); renderTSide(); tRender(); tSave(); }

/* ---------- tileset ---------- */
function setTileset(img, name, tile) {
  tPush(); if (tile) tm.tw = tm.th = tile; const c = imgToCanvas(img); tm.tileset = { name: name || 'tileset', url: c.toDataURL('image/png'), w: img.width, h: img.height };
  loadTsImage(() => { ts.sel = { x: 0, y: 0, w: 1, h: 1 }; renderTSide(); mapDirty = true; tRender(); tSave(); toast(`Tileset ${img.width}×${img.height} · ${tsCols * tsRows} tiles de ${tm.tw}×${tm.th} (⌘Z desfaz)`); });
}
function loadTsImage(cb) { if (!tm.tileset) { tsImg = null; tsCols = tsRows = 0; cb && cb(); return; } const im = new Image(); im.onload = () => { tsImg = im; tsCols = Math.max(1, Math.floor(im.width / tm.tw)); tsRows = Math.max(1, Math.floor(im.height / tm.th)); mapDirty = true; cb && cb(); };
  im.onerror = () => { tm.tileset = null; tsImg = null; tsCols = tsRows = 0; mapDirty = true; toast('Não consegui abrir a imagem do tileset'); cb && cb(); }; im.src = tm.tileset.url; }
function demoTileset() { // 8 tiles de 16 px: grama, terra, água, pedra, areia, madeira, flor, parede
  const T = 16, cols = ['#38b764', '#a0663a', '#3b5dc9', '#94b0c2', '#ffcd75', '#b86f50', '#38b764', '#566c86'], c = document.createElement('canvas'); c.width = T * 8; c.height = T; const x = c.getContext('2d');
  let s = 3; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  cols.forEach((col, i) => { x.fillStyle = col; x.fillRect(i * T, 0, T, T); for (let k = 0; k < 14; k++) { x.fillStyle = k % 2 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.18)'; x.fillRect(i * T + Math.floor(rnd() * T), Math.floor(rnd() * T), 1, 1); }
    if (i === 6) { x.fillStyle = '#ef7d57'; x.fillRect(i * T + 5, 5, 2, 2); x.fillRect(i * T + 10, 9, 2, 2); x.fillStyle = '#ffcd75'; x.fillRect(i * T + 7, 11, 2, 2); }
    if (i === 7) { x.fillStyle = '#333c57'; for (let yy = 3; yy < T; yy += 5) x.fillRect(i * T, yy, T, 1); for (let yy = 0; yy < T; yy += 5) x.fillRect(i * T + ((yy / 5) % 2 ? 4 : 11), yy, 1, 4); }
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.strokeRect(i * T + .5, .5, T - 1, T - 1); });
  return { width: c.width, height: c.height, data: x.getImageData(0, 0, c.width, c.height).data };
}
const tileAt = (L, i) => { if (!L.auto) return L.data[i]; if (!L.cells[i]) return -1; const x = i % tm.mw, y = (i / tm.mw) | 0, on = (xx, yy) => xx >= 0 && yy >= 0 && xx < tm.mw && yy < tm.mh && L.cells[yy * tm.mw + xx];
  const m = (on(x, y - 1) ? 1 : 0) | (on(x + 1, y) ? 2 : 0) | (on(x, y + 1) ? 4 : 0) | (on(x - 1, y) ? 8 : 0); if (L.rules[m] >= 0) return L.rules[m]; if (L.rules[15] >= 0) return L.rules[15]; return L.rules.find(r => r >= 0) ?? -1; };
function drawTile(ctx, t, dx, dy, s = 1) { if (t < 0 || !tsImg) return; ctx.drawImage(tsImg, (t % tsCols) * tm.tw, Math.floor(t / tsCols) * tm.th, tm.tw, tm.th, dx, dy, tm.tw * s, tm.th * s); }
function rebuildMap() { mapOff.width = tm.mw * tm.tw; mapOff.height = tm.mh * tm.th; const x = mapOff.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, mapOff.width, mapOff.height);
  for (const L of tm.layers) { if (!L.visible) continue; for (let i = 0; i < L.data.length; i++) { const t = tileAt(L, i); if (t >= 0) drawTile(x, t, (i % tm.mw) * tm.tw, ((i / tm.mw) | 0) * tm.th); } } mapDirty = false; }

/* ---------- render ---------- */
let tRaf = 0, tHover = null;
const tRender = () => { if (!tRaf) tRaf = requestAnimationFrame(tDraw); };
function tResize() { const r = tArea.getBoundingClientRect(), d = devicePixelRatio || 1; tcv.width = Math.max(1, Math.round(r.width * d)); tcv.height = Math.max(1, Math.round(r.height * d)); tRender(); }
function tFit() { const r = tArea.getBoundingClientRect(); if (!r.width) return; const W = tm.mw * tm.tw, H = tm.mh * tm.th; ts.zoom = Math.max(.25, Math.min((r.width - 32) / W, (r.height - 32) / H)); if (ts.zoom >= 1) ts.zoom = Math.floor(ts.zoom); ts.ox = Math.round((r.width - W * ts.zoom) / 2); ts.oy = Math.round((r.height - H * ts.zoom) / 2); tRender(); }
function tZoomAt(nz, sx, sy) { nz = clamp(nz, .25, 32); const k = nz / ts.zoom; ts.ox = sx - (sx - ts.ox) * k; ts.oy = sy - (sy - ts.oy) * k; ts.zoom = nz; tRender(); }
function tDraw() {
  tRaf = 0; if (mapDirty) rebuildMap(); const d = devicePixelRatio || 1, z = ts.zoom, W = tm.mw * tm.tw * z, H = tm.mh * tm.th * z;
  tcx.setTransform(1, 0, 0, 1, 0, 0); tcx.clearRect(0, 0, tcv.width, tcv.height); tcx.setTransform(d, 0, 0, d, 0, 0);
  const cs = getComputedStyle(document.documentElement), ca = `rgb(${cs.getPropertyValue('--check-a').trim().replace(/ /g, ',')})`, cb = `rgb(${cs.getPropertyValue('--check-b').trim().replace(/ /g, ',')})`;
  tcx.fillStyle = cb; tcx.fillRect(ts.ox, ts.oy, W, H); tcx.fillStyle = ca; const cell = 16; tcx.save(); tcx.beginPath(); tcx.rect(ts.ox, ts.oy, W, H); tcx.clip();
  for (let y = 0; y * cell < H; y++) for (let x = y % 2; x * cell < W; x += 2) tcx.fillRect(ts.ox + x * cell, ts.oy + y * cell, cell, cell); tcx.restore();
  tcx.imageSmoothingEnabled = false; tcx.drawImage(mapOff, ts.ox, ts.oy, W, H);
  const tw = tm.tw * z, th = tm.th * z;
  if (ts.grid && tw >= 6) { tcx.strokeStyle = document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.1)'; tcx.lineWidth = 1; tcx.beginPath();
    for (let x = 0; x <= tm.mw; x++) { const X = Math.round(ts.ox + x * tw) + .5; tcx.moveTo(X, ts.oy); tcx.lineTo(X, ts.oy + H); } for (let y = 0; y <= tm.mh; y++) { const Y = Math.round(ts.oy + y * th) + .5; tcx.moveTo(ts.ox, Y); tcx.lineTo(ts.ox + W, Y); } tcx.stroke(); }
  const acc = `rgb(${cs.getPropertyValue('--plum').trim().replace(/ /g, ',')})`; // ameixa = cor de seleção do DESIGN.md
  if (tRect) { tcx.strokeStyle = acc; tcx.lineWidth = 2; const a = Math.min(tRect.x0, tRect.x1), b = Math.min(tRect.y0, tRect.y1); tcx.strokeRect(ts.ox + a * tw, ts.oy + b * th, (Math.abs(tRect.x1 - tRect.x0) + 1) * tw, (Math.abs(tRect.y1 - tRect.y0) + 1) * th); }
  else if (tHover && ['stamp', 'erase', 'rect', 'fill'].includes(ts.tool)) { const L = tm.layers[ts.layer], block = ts.tool === 'stamp' && !L.auto && !ts.random && !tBrushApplies(),
      n = ['stamp', 'erase'].includes(ts.tool) && tBrushApplies() ? ts.brush : 1, r0 = -Math.floor((n - 1) / 2), w = block ? ts.sel.w : n, h = block ? ts.sel.h : n, hx = tHover[0] + (block ? 0 : r0), hy = tHover[1] + (block ? 0 : r0);
    if (ts.tool === 'stamp' && tsImg && !L.auto && !ts.random) { tcx.globalAlpha = .55; for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) drawTile(tcx, block ? (ts.sel.y + yy) * tsCols + ts.sel.x + xx : ts.sel.y * tsCols + ts.sel.x, ts.ox + (hx + xx) * tw, ts.oy + (hy + yy) * th, z); tcx.globalAlpha = 1; }
    tcx.strokeStyle = acc; tcx.lineWidth = 2; tcx.strokeRect(ts.ox + hx * tw, ts.oy + hy * th, w * tw, h * th); }
  if (ts.msel) { const m = ts.msel, X = ts.ox + m.x * tw + .5, Y = ts.oy + m.y * th + .5; tcx.lineWidth = 1.5; tcx.strokeStyle = '#fff'; tcx.strokeRect(X, Y, m.w * tw, m.h * th); tcx.strokeStyle = acc; tcx.setLineDash([6, 4]); tcx.strokeRect(X, Y, m.w * tw, m.h * th); tcx.setLineDash([]); }
  tcx.strokeStyle = 'rgba(128,128,140,.5)'; tcx.lineWidth = 1; tcx.strokeRect(ts.ox - .5, ts.oy - .5, W + 1, H + 1);
  $('#tZoomLbl').textContent = Math.round(z * 100) + '%'; $('#tSize').textContent = `${tm.mw}×${tm.mh} tiles de ${tm.tw}×${tm.th} · ${tm.mw * tm.tw}×${tm.mh * tm.th} px · ${tm.layers[ts.layer]?.name || ''}`;
  $('#tUndo').disabled = !tHist.length; $('#tRedo').disabled = !tFuture.length; $('#tPenBtn').classList.toggle('on', st.penOnly); $('#tPenTxt').textContent = st.penOnly ? 'Só Pencil' : 'Dedo pinta';
}

/* ---------- pintura ---------- */
const tCell = (cx_, cy_) => { const r = tcv.getBoundingClientRect(); return [Math.floor((cx_ - r.left - ts.ox) / (tm.tw * ts.zoom)), Math.floor((cy_ - r.top - ts.oy) / (tm.th * ts.zoom))]; };
const tIn = (x, y) => x >= 0 && y >= 0 && x < tm.mw && y < tm.mh;
const selTiles = () => { const a = []; for (let y = 0; y < ts.sel.h; y++) for (let x = 0; x < ts.sel.w; x++) a.push((ts.sel.y + y) * tsCols + ts.sel.x + x); return a; };
function tSet(L, x, y, t) { if (!tIn(x, y)) return; const i = y * tm.mw + x; if (L.auto) L.cells[i] = t >= 0 ? 1 : 0; else L.data[i] = t; }
function tStampAt(x, y, erase, anchor) {
  const L = tm.layers[ts.layer];
  if (erase) { tSet(L, x, y, -1); return; }
  if (L.auto) { tSet(L, x, y, 1); return; }
  if (!tsImg) return; const list = selTiles();
  if (ts.random) { tSet(L, x, y, list[Math.floor(Math.random() * list.length)]); return; }
  const ax = anchor ? anchor[0] : x, ay = anchor ? anchor[1] : y; // pinta o bloco selecionado alinhado ao ponto inicial
  if (anchor) { const dx = ((x - ax) % ts.sel.w + ts.sel.w) % ts.sel.w, dy = ((y - ay) % ts.sel.h + ts.sel.h) % ts.sel.h; tSet(L, x, y, (ts.sel.y + dy) * tsCols + ts.sel.x + dx); }
  else for (let yy = 0; yy < ts.sel.h; yy++) for (let xx = 0; xx < ts.sel.w; xx++) tSet(L, x + xx, y + yy, (ts.sel.y + yy) * tsCols + ts.sel.x + xx);
}
/** O tamanho do pincel vale para tile único, aleatório, autotile e borracha; um carimbo de vários tiles usa o próprio tamanho. */
const tBrushApplies = () => { const L = tm.layers[ts.layer]; return ts.brush > 1 && (ts.tool === 'erase' || L.auto || ts.random || ts.sel.w * ts.sel.h === 1); };
function tPaintAt(x, y, erase, anchor) {
  if (!tBrushApplies()) return tStampAt(x, y, erase, anchor);
  const n = ts.brush, r0 = -Math.floor((n - 1) / 2);
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) tStampAt(x + r0 + dx, y + r0 + dy, erase, null);
}
function setTBrush(n) { ts.brush = clamp(n | 0, 1, 8); LS.set('tBrush', ts.brush); renderTBrush(); tRender(); }

/* ---------- seleção no mapa (camada atual) ---------- */
const tGetV = (L, i) => L.auto ? L.cells[i] : L.data[i];
const tSetV = (L, i, v) => { if (L.auto) L.cells[i] = v > 0 ? 1 : 0; else L.data[i] = v; };
const tEmpty = (L) => L.auto ? 0 : -1;
const tInSel = (x, y) => ts.msel && x >= ts.msel.x && y >= ts.msel.y && x < ts.msel.x + ts.msel.w && y < ts.msel.y + ts.msel.h;
/** Parte da seleção que está dentro do mapa (a seleção pode ter saído pela borda ao mover). */
const tSelClip = () => { const m = ts.msel; if (!m) return null; const x0 = Math.max(0, m.x), y0 = Math.max(0, m.y), x1 = Math.min(tm.mw, m.x + m.w), y1 = Math.min(tm.mh, m.y + m.h); return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null; };
/** Move o conteúdo de `s` (no estado `base` da camada) por dx, dy; o que sai do mapa se perde, como no editor. */
function tShiftSel(L, base, s, dx, dy) {
  const arr = L.auto ? L.cells : L.data, W = tm.mw, e = tEmpty(L); arr.set(base);
  for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) if (tIn(x, y)) arr[y * W + x] = e;
  for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) { const tx = x + dx, ty = y + dy; if (tIn(x, y) && tIn(tx, ty)) arr[ty * W + tx] = base[y * W + x]; }
  ts.msel = { x: s.x + dx, y: s.y + dy, w: s.w, h: s.h };
}
function tCopy(cut) {
  const s = tSelClip(); if (!s) return toast('Selecione uma área do mapa primeiro (ferramenta Seleção, S)');
  const L = tm.layers[ts.layer], vals = new Int32Array(s.w * s.h), tiles = new Int32Array(s.w * s.h);
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const i = (s.y + y) * tm.mw + s.x + x; vals[y * s.w + x] = tGetV(L, i); tiles[y * s.w + x] = tileAt(L, i); }
  tClip = { w: s.w, h: s.h, x: s.x, y: s.y, auto: L.auto, vals, tiles };
  if (cut) { if (!L.visible) return toast('A camada está oculta'); tPush(); for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) tSetV(L, y * tm.mw + x, tEmpty(L)); mapDirty = true; tRender(); tSave(); }
  renderTSelBar(); toast(cut ? 'Recortado' : `Copiado: ${s.w}×${s.h} tiles`);
}
function tPaste() {
  if (!tClip) return toast('Nada copiado no mapa ainda'); const L = tm.layers[ts.layer]; if (!L.visible) return toast('A camada está oculta');
  tPush(); const x0 = ts.msel ? clamp(ts.msel.x, 0, tm.mw - 1) : clamp(tClip.x, 0, tm.mw - 1), y0 = ts.msel ? clamp(ts.msel.y, 0, tm.mh - 1) : clamp(tClip.y, 0, tm.mh - 1);
  for (let y = 0; y < tClip.h; y++) for (let x = 0; x < tClip.w; x++) { if (!tIn(x0 + x, y0 + y)) continue; const k = y * tClip.w + x;
    // camadas do mesmo tipo recebem o valor; autotile → normal recebe o tile resolvido; normal → autotile vira "tem terreno"
    const v = L.auto === tClip.auto ? tClip.vals[k] : L.auto ? (tClip.vals[k] >= 0 ? 1 : 0) : tClip.tiles[k];
    if (v !== tEmpty(L) && v >= 0) tSetV(L, (y0 + y) * tm.mw + x0 + x, v); } // colar não apaga o que está embaixo das células vazias
  ts.msel = { x: x0, y: y0, w: tClip.w, h: tClip.h }; mapDirty = true; setTTool('select'); tRender(); tSave(); renderTSelBar(); toast('Colado: arraste a seleção para posicionar');
}
function tDeleteSel() {
  const s = tSelClip(); if (!s) return; const L = tm.layers[ts.layer]; if (!L.visible) return toast('A camada está oculta');
  tPush(); for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) tSetV(L, y * tm.mw + x, tEmpty(L)); mapDirty = true; tRender(); tSave();
}
function tDeselect() { ts.msel = null; tRender(); renderTSelBar(); }
function renderTSelBar() {
  const b = $('#tSelBar'); if (!b) return; const m = ts.msel;
  b.innerHTML = m ? `<span class="mono small muted">${m.w}×${m.h}</span>` + [['copy', 'copy', 'Copiar (⌘C)'], ['cut', 'scissors', 'Recortar (⌘X)'], ['paste', 'clipboard', 'Colar (⌘V)'], ['del', 'trash', 'Apagar a área (Delete)'], ['desel', 'x', 'Tirar seleção (Esc)']].map(x => `<button class="btn sm ic" data-tsb="${x[0]}" title="${x[2]}" aria-label="${x[2]}">${ico(x[1])}</button>`).join('') + '<span class="sep"></span>'
    : tClip ? `<button class="btn sm ic" data-tsb="paste" title="Colar (⌘V)" aria-label="Colar">${ico('clipboard')}</button><span class="sep"></span>` : '';
}
function tFill(x, y) {
  const L = tm.layers[ts.layer]; if (!tIn(x, y)) return false; const get = (i) => L.auto ? L.cells[i] : L.data[i], target = get(y * tm.mw + x), seen = new Uint8Array(tm.mw * tm.mh), st_ = [x, y];
  const list = selTiles(); if (!L.auto && !tsImg) return false; let changed = false;
  while (st_.length) { const yy = st_.pop(), xx = st_.pop(); if (!tIn(xx, yy)) continue; const i = yy * tm.mw + xx; if (seen[i] || get(i) !== target) continue; seen[i] = 1;
    const before = get(i);
    if (L.auto) L.cells[i] = 1; else L.data[i] = ts.random ? list[Math.floor(Math.random() * list.length)] : (ts.sel.y + ((yy - y) % ts.sel.h + ts.sel.h) % ts.sel.h) * tsCols + ts.sel.x + ((xx - x) % ts.sel.w + ts.sel.w) % ts.sel.w;
    if (get(i) !== before) changed = true;
    st_.push(xx + 1, yy, xx - 1, yy, xx, yy + 1, xx, yy - 1); }
  return changed;
}
let tStroke = null, tRect = null;
function tBegin(x, y, id) {
  const L = tm.layers[ts.layer];
  if (ts.tool === 'select') {
    if (tInSel(x, y) && tSelClip()) { // arrastar dentro da seleção move o conteúdo
      if (!L.visible) { toast('A camada está oculta'); tStroke = { noop: true }; return; }
      const fut = tPush(); tStroke = { id, fut, move: true, x0: x, y0: y, sel0: { ...tSelClip() }, base: (L.auto ? L.cells : L.data).slice(), changed: false }; return; }
    tStroke = { id, select: true, x0: x, y0: y, prev: ts.msel, moved: false }; ts.msel = { x: clamp(x, 0, tm.mw - 1), y: clamp(y, 0, tm.mh - 1), w: 1, h: 1 }; tRender(); return; // selecionar não entra no desfazer
  }
  if (!L.visible) { toast('A camada está oculta'); tStroke = { noop: true }; return; }
  if (ts.tool === 'pick') { const i = y * tm.mw + x; if (tIn(x, y)) { const t = tileAt(L, i); if (t >= 0) { ts.sel = { x: t % tsCols, y: Math.floor(t / tsCols), w: 1, h: 1 }; setTTool('stamp'); renderTileset(); } } tStroke = { noop: true }; return; }
  const fut = tPush(); tStroke = { id, fut, lx: x, ly: y, anchor: [x, y], changed: false };
  if (ts.tool === 'fill') { tStroke.changed = tFill(x, y); tEnd(); return; } // sem isso o tEnd achava que nada mudou: não redesenhava e jogava fora o desfazer
  if (ts.tool === 'rect') { tRect = { x0: x, y0: y, x1: x, y1: y }; tRender(); return; }
  tPaintAt(x, y, ts.tool === 'erase', null); tStroke.changed = true; mapDirty = true; tRender();
}
function tMove(x, y) {
  if (!tStroke || tStroke.noop) return;
  if (tStroke.select) { const a = clamp(Math.min(tStroke.x0, x), 0, tm.mw - 1), b = clamp(Math.min(tStroke.y0, y), 0, tm.mh - 1);
    ts.msel = { x: a, y: b, w: clamp(Math.max(tStroke.x0, x), 0, tm.mw - 1) - a + 1, h: clamp(Math.max(tStroke.y0, y), 0, tm.mh - 1) - b + 1 }; tStroke.moved = tStroke.moved || x !== tStroke.x0 || y !== tStroke.y0; tRender(); return; }
  if (tStroke.move) { const dx = x - tStroke.x0, dy = y - tStroke.y0; tShiftSel(tm.layers[ts.layer], tStroke.base, tStroke.sel0, dx, dy); tStroke.changed = dx !== 0 || dy !== 0; mapDirty = true; tRender(); return; }
  if (ts.tool === 'rect') { tRect.x1 = x; tRect.y1 = y; tRender(); return; }
  const L = tm.layers[ts.layer], multi = ts.sel.w * ts.sel.h > 1 && !L.auto && !ts.random;
  const pts = linePts(tStroke.lx, tStroke.ly, x, y); for (let i = 1; i < pts.length; i++) tPaintAt(pts[i][0], pts[i][1], ts.tool === 'erase', multi ? tStroke.anchor : null);
  tStroke.lx = x; tStroke.ly = y; tStroke.changed = true; mapDirty = true; tRender();
}
function tEnd() {
  if (!tStroke || tStroke.noop) { tStroke = null; return; }
  if (tStroke.select) { if (!tStroke.moved) ts.msel = null; tStroke = null; tRender(); renderTSelBar(); return; } // toque sem arrastar tira a seleção
  if (tRect) { const a = Math.min(tRect.x0, tRect.x1), b = Math.min(tRect.y0, tRect.y1), c = Math.max(tRect.x0, tRect.x1), d = Math.max(tRect.y0, tRect.y1), L = tm.layers[ts.layer];
    for (let y = b; y <= d; y++) for (let x = a; x <= c; x++) { if (L.auto) tSet(L, x, y, 1); else if (ts.random) tStampAt(x, y, false, null); else tStampAt(x, y, false, [a, b]); }
    tRect = null; tStroke.changed = true; mapDirty = true; }
  if (!tStroke.changed) { tHist.pop(); if (tStroke.fut) tFuture.push(...tStroke.fut); } else mapDirty = true; // nada mudou: o refazer continua
  tStroke = null; tRender(); tSave(); renderTLayers();
}
function tAbort() {
  if (tStroke && tStroke.select) ts.msel = tStroke.prev; // a pinça começou: volta a seleção que existia
  else if (tStroke && !tStroke.noop && tHist.length) { tRestore(tHist.pop()); if (tStroke.fut) tFuture.push(...tStroke.fut); } // traço cancelado (ex.: virou gesto de dedos): devolve o refazer
  tStroke = null; tRect = null; tRender(); renderTSelBar();
}

/* ---------- entrada (mesmos gestos do editor) ---------- */
const TT_T = new Map(); let tPin = null, tGest = null, tPenDown = false, tPan = null, tFillPend = null, tView0 = null;
const tGestUndo = () => { if (!tHist.length) return toast('Nada para desfazer', 900); tUndo(); toast('Desfeito (dois dedos)', 900); };
const tGestRedo = () => { if (!tFuture.length) return toast('Nada para refazer', 900); tRedo(); toast('Refeito (três dedos)', 900); };
const tMeio = () => { const p = [...TT_T.values()]; return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2, d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1 }; };
tcv.addEventListener('pointerdown', (e) => {
  try { tcv.setPointerCapture(e.pointerId); } catch {}
  if (e.pointerType === 'pen') { tPenDown = true; tPin = null; tPan = null; if (!st.penSeen && !st.penOnly) setPenOnly(true, true); }
  if (e.pointerType === 'touch') { TT_T.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
    if (TT_T.size > 1) { tFillPend = null; if (!tGest) tGest = { t0: performance.now(), max: 0, moved: false, view: tView0 }; tGest.max = Math.max(tGest.max, TT_T.size); if (!tPenDown) gestArm(tGest, tGestUndo, tGestRedo); }
    else { if (tGest) gestStop(tGest); tGest = null; tView0 = { zoom: ts.zoom, ox: ts.ox, oy: ts.oy }; }
    // mesma regra do editor: o 1º dedo só transforma o gesto em pinça se já estava pintando de verdade (> 250 ms ou > 14 px)
    if (TT_T.size === 2 && !tPenDown) { if (tStroke && !tStroke.noop) { const f = [...TT_T.values()][0], longo = performance.now() - f.t0 > 250 || Math.hypot(f.x - f.x0, f.y - f.y0) > 14; tAbort(); if (tGest && longo) tGest.moved = true; } tStroke = null; tPan = null; const m = tMeio(), r = tcv.getBoundingClientRect(); tPin = { d0: m.d, z0: ts.zoom, mx: m.x - r.left, my: m.y - r.top, ox: ts.ox, oy: ts.oy }; return; }
    if (TT_T.size > 2) return; }
  if (tPin || (tPenDown && e.pointerType === 'touch')) return;
  if (ts.tool === 'hand' || e.button === 1 || e.button === 2 || panMode || (e.pointerType === 'touch' && st.penOnly)) { tPan = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: ts.ox, oy: ts.oy }; return; }
  const [x, y] = tCell(e.clientX, e.clientY);
  if (ts.tool === 'fill' && e.pointerType === 'touch') { tFillPend = { id: e.pointerId, x, y }; return; }
  tBegin(x, y, e.pointerId);
});
tcv.addEventListener('pointermove', (e) => {
  const [x, y] = tCell(e.clientX, e.clientY); $('#tPos').textContent = tIn(x, y) ? `${x}, ${y}` : '—';
  if ((e.pointerType === 'pen' || e.pointerType === 'mouse') && !e.buttons) { const h = tIn(x, y) ? [x, y] : null; if (String(h) !== String(tHover)) { tHover = h; tRender(); } }
  if (TT_T.has(e.pointerId)) { const t = TT_T.get(e.pointerId); t.x = e.clientX; t.y = e.clientY; const d = Math.hypot(t.x - t.x0, t.y - t.y0); if (tGest && d > 14) tGest.moved = true; if (tFillPend && tFillPend.id === e.pointerId && d > 9) tFillPend = null; }
  if (tPin && TT_T.size >= 2) { const m = tMeio(), r = tcv.getBoundingClientRect(), nz = clamp(tPin.z0 * m.d / tPin.d0, .25, 32), k = nz / tPin.z0; ts.zoom = nz; ts.ox = (m.x - r.left) - (tPin.mx - tPin.ox) * k; ts.oy = (m.y - r.top) - (tPin.my - tPin.oy) * k; tRender(); return; }
  if (tPan && tPan.id === e.pointerId) { ts.ox = tPan.ox + e.clientX - tPan.sx; ts.oy = tPan.oy + e.clientY - tPan.sy; tRender(); return; }
  if (tStroke && tStroke.id === e.pointerId) tMove(x, y);
});
tcv.addEventListener('pointerleave', () => { if (tHover) { tHover = null; tRender(); } });
function tUp(e) {
  if (e.pointerType === 'pen') tPenDown = false;
  const was = TT_T.delete(e.pointerId);
  if (was && TT_T.size === 0 && tGest) { const g = tGest; tGest = null; tPin = null; tPan = null; gestStop(g);
    if (!g.moved && !g.held && performance.now() - g.t0 < 450 && e.type === 'pointerup') { if (g.max === 2) tGestUndo(); else if (g.max >= 3) tGestRedo(); }
    if (!g.moved && g.view) { ts.zoom = g.view.zoom; ts.ox = g.view.ox; ts.oy = g.view.oy; tRender(); } // foi toque, não pinça: a vista não mexe
    return; }
  if (was && tPin && TT_T.size < 2) { tPin = null; return; }
  if (tFillPend && tFillPend.id === e.pointerId) { const f = tFillPend; tFillPend = null; if (e.type === 'pointerup' && !tGest && !tPin) tBegin(f.x, f.y, e.pointerId); return; }
  if (tPan && tPan.id === e.pointerId) { tPan = null; return; }
  if (tStroke && tStroke.id === e.pointerId) { e.type === 'pointercancel' ? tAbort() : tEnd(); }
}
tcv.addEventListener('pointerup', tUp); tcv.addEventListener('pointercancel', tUp); tcv.addEventListener('contextmenu', (e) => e.preventDefault());
tArea.addEventListener('wheel', (e) => { e.preventDefault(); const r = tcv.getBoundingClientRect(); if (e.ctrlKey || e.metaKey || (Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey)) tZoomAt(ts.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX - r.left, e.clientY - r.top); else { ts.ox -= e.shiftKey ? e.deltaY : e.deltaX; tRender(); } }, { passive: false });

/* ---------- trilho e barra ---------- */
function setTTool(t) { ts.tool = t; $$('#tRail [data-tt]').forEach(b => b.classList.toggle('on', b.dataset.tt === t)); tRender(); }
$('#tRail').innerHTML = TT.map(t => t === '|' ? '<hr>' : `<button class="tool" data-tt="${t[0]}" title="${t[2]} (${t[3]})">${ico(t[1])}<span class="k">${t[3]}</span></button>`).join('') +
  `<hr><button class="tool tog" data-tr="random" title="Aleatório: cada célula recebe um tile sorteado da seleção (R)">${ico('dice')}</button><button class="tool tog on" data-tr="grid" title="Grade">${ico('grid')}</button>`;
$('#tRail').addEventListener('click', (e) => { const t = e.target.closest('[data-tt]'); if (t) return setTTool(t.dataset.tt); const r = e.target.closest('[data-tr]'); if (!r) return; ts[r.dataset.tr] = !ts[r.dataset.tr]; r.classList.toggle('on', ts[r.dataset.tr]); tRender(); });
// barra da seleção do mapa (o contêiner não é recriado: listener ligado uma vez só)
$('#tSelBar').addEventListener('click', (e) => { const b = e.target.closest('[data-tsb]'); if (!b) return; const k = b.dataset.tsb;
  if (k === 'copy') tCopy(false); else if (k === 'cut') tCopy(true); else if (k === 'paste') tPaste(); else if (k === 'del') tDeleteSel(); else tDeselect(); });
$('#tUndo').onclick = tUndo; $('#tRedo').onclick = tRedo; $('#tPenBtn').onclick = () => { setPenOnly(!st.penOnly); tRender(); };
$('#tZoomIn').onclick = () => { const r = tArea.getBoundingClientRect(); tZoomAt(ts.zoom * 1.25, r.width / 2, r.height / 2); };
$('#tZoomOut').onclick = () => { const r = tArea.getBoundingClientRect(); tZoomAt(ts.zoom / 1.25, r.width / 2, r.height / 2); };
$('#tZoomLbl').onclick = tFit;
function tileKey(e) {
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod) { if (k === 'z') { e.preventDefault(); e.shiftKey ? tRedo() : tUndo(); } else if (k === 'y') { e.preventDefault(); tRedo(); } else if (k === 's') { e.preventDefault(); tFile('save'); }
    else if (k === 'c') { e.preventDefault(); tCopy(false); } else if (k === 'x') { e.preventDefault(); tCopy(true); } else if (k === 'v') { e.preventDefault(); tPaste(); }
    else if (k === 'a') { e.preventDefault(); ts.msel = { x: 0, y: 0, w: tm.mw, h: tm.mh }; setTTool('select'); renderTSelBar(); } return; }
  if (k === ' ') { panMode = true; e.preventDefault(); return; }
  if ((k === 'delete' || k === 'backspace') && ts.msel) { e.preventDefault(); tDeleteSel(); return; }
  if (k === '[' || k === ']') { const i = T_BRUSHES.indexOf(ts.brush); setTBrush(T_BRUSHES[clamp((i < 0 ? 0 : i) + (k === '[' ? -1 : 1), 0, T_BRUSHES.length - 1)]); return; }
  const map = { b: 'stamp', e: 'erase', g: 'fill', u: 'rect', i: 'pick', s: 'select', h: 'hand' }; if (map[k]) return setTTool(map[k]);
  if (k === 'r') { ts.random = !ts.random; $('#tRail [data-tr=random]').classList.toggle('on', ts.random); tRender(); } else if (k === '0') tFit(); else if (k === '+' || k === '=') $('#tZoomIn').click(); else if (k === '-') $('#tZoomOut').click();
}

/* ---------- painel direito ---------- */
const tCardOpen = LS.get('tcards', { tileset: true, mapa: true, tcamadas: true, auto: true });
const tCard = (id, title, acts = '') => `<div class="card${tCardOpen[id] === false ? ' closed' : ''}" style="--dc:var(--c-tile)"><div class="card-h" data-ttoggle="${id}"><span class="dot"></span>${title}${acts ? `<span class="acts">${acts}</span>` : '<span class="spacer"></span>'}<span class="cv">${ico('chevron')}</span></div><div class="card-b" id="tb-${id}"></div></div>`;
const tb3 = (k, icon, title, cls = '') => `<button class="btn sm ic ${cls}" data-tp="${k}" title="${esc(title)}">${ico(icon)}</button>`;
function renderTSide() {
  const L = tm.layers[ts.layer];
  // ordem: Camadas logo abaixo do tileset (criar autotile e tocar nas regras sem rolar o painel no iPad); Mapa, o menos usado, por último
  $('#tSide').innerHTML = tCard('tileset', 'Tileset') + tCard('tcamadas', 'Camadas', tb3('tAdd', 'plus', 'Nova camada') + tb3('tAddAuto', 'auto', 'Nova camada de autotile') + tb3('tDel', 'trash', 'Excluir camada', 'danger')) + tCard('tpincel', 'Pincel') + tCard('mapa', 'Mapa');
  const tb = $('#tb-tileset');
  tb.innerHTML = `<div class="row wrap"><button class="btn sm" data-tp="tsImport">${ico('upload')}Importar PNG</button><button class="btn sm" data-tp="tsEditor">Do editor</button><button class="btn sm" data-tp="tsDemo">Exemplo</button></div>
    <div class="lbl">Tamanho do tile<div class="chips" id="tTileSz">${TILE_SIZES.map(s => `<button data-ts="${s}" class="${tm.tw === s && tm.th === s ? 'on' : ''}">${s}</button>`).join('')}</div></div>
    ${tsImg ? `<div class="tileset-wrap checker" id="tsWrap"><canvas class="px" id="tsCv"></canvas></div><span class="hint">${tsCols * tsRows} tiles · toque num tile ou arraste para selecionar vários (vira um carimbo). Seleção: ${ts.sel.w}×${ts.sel.h}.</span>${L && L.auto ? '<div id="tb-auto" class="stack" style="gap:8px"></div>' : ''}` : '<div class="note">Importe um tileset (PNG com os tiles em grade) ou use o de exemplo para testar.</div>'}`;
  const mb = $('#tb-mapa');
  mb.innerHTML = `<div class="row"><span class="small muted">Atual</span><b class="mono small">${tm.mw}×${tm.mh} tiles</b></div><div class="chips">${SIZES.map(s => `<button data-ms="${s}" class="${tm.mw === s && tm.mh === s ? 'on' : ''}">${s}</button>`).join('')}</div>
    <div class="grid2"><label class="lbl">Largura<input class="input-field" id="tMw" inputmode="numeric" value="${tm.mw}"></label><label class="lbl">Altura<input class="input-field" id="tMh" inputmode="numeric" value="${tm.mh}"></label></div><button class="btn sm" data-tp="tResize">Aplicar tamanho</button>`;
  renderTBrush(); renderTLayers(); if (L && L.auto) renderAuto(); renderTileset();
}
function renderTBrush() {
  const b = $('#tb-tpincel'); if (!b) return;
  b.innerHTML = `<div class="lbl"><span>Tamanho: ${ts.brush}×${ts.brush} tiles <span class="muted" style="font-weight:500">(teclas [ e ])</span></span><div class="chips">${T_BRUSHES.map(n => `<button data-tbr="${n}" class="${n === ts.brush ? 'on' : ''}" aria-label="Pincel de ${n}×${n} tiles">${n}</button>`).join('')}</div></div>
    <span class="hint">Vale para tile único, aleatório, autotile e borracha; carimbo de vários tiles usa o próprio tamanho.</span>`;
}
function renderTLayers() {
  const b = $('#tb-tcamadas'); if (!b) return;
  b.innerHTML = `<div class="layers">${tm.layers.map((_, i) => i).reverse().map(i => { const L = tm.layers[i]; return `<div class="layer${i === ts.layer ? ' sel' : ''}" data-tli="${i}"><span class="li">${ico(L.auto ? 'auto' : 'tiles')}</span><span class="nm" data-tnm="${i}">${esc(L.name)}</span><button class="li${L.visible ? '' : ' off'}" data-tvis="${i}">${ico(L.visible ? 'eye' : 'eyeoff')}</button></div>`; }).join('')}</div>
    <div class="row" style="gap:3px"><span class="small muted" style="width:44px">Ordem</span>${tb3('tUp', 'up', 'Subir')}${tb3('tDown', 'down', 'Descer')}<span class="spacer"></span>${tb3('tRen', 'pencil', 'Renomear')}</div>`;
}
const MASK_SVG = (m) => `<svg viewBox="0 0 30 30"><rect x="10" y="10" width="10" height="10" fill="currentColor"/>${m & 1 ? '<rect x="10" y="0" width="10" height="10" fill="currentColor"/>' : ''}${m & 2 ? '<rect x="20" y="10" width="10" height="10" fill="currentColor"/>' : ''}${m & 4 ? '<rect x="10" y="20" width="10" height="10" fill="currentColor"/>' : ''}${m & 8 ? '<rect x="0" y="10" width="10" height="10" fill="currentColor"/>' : ''}</svg>`;
function renderAuto() {
  const b = $('#tb-auto'); if (!b) return; const L = tm.layers[ts.layer];
  b.innerHTML = `<b class="small">Regras de autotile · ${esc(L.name)}</b><span class="hint">Cada quadrado é uma combinação de vizinhos (o desenho mostra quais lados têm terreno). Toque num quadrado e depois num tile do tileset. O quadrado cheio (todos os lados) é o padrão para os que faltarem.</span>
    <div class="slots">${L.rules.map((t, m) => `<button class="slot${ts.slot === m ? ' on' : ''}" data-slot="${m}" title="Vizinhos: ${['cima', 'direita', 'baixo', 'esquerda'].filter((_, k) => m & (1 << k)).join(', ') || 'nenhum'}">${t >= 0 ? `<canvas class="px" data-st="${t}"></canvas>` : MASK_SVG(m)}</button>`).join('')}</div>
    <div class="row wrap"><button class="btn sm" data-tp="autoFill">Usar o tile selecionado em todos</button><button class="btn sm danger" data-tp="autoClear">Limpar regras</button></div>`;
  $$('#tb-auto canvas[data-st]').forEach(c => { c.width = tm.tw; c.height = tm.th; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; drawTile(x, +c.dataset.st, 0, 0); });
}
function renderTileset() {
  const c = $('#tsCv'); if (!c || !tsImg) return; const wrap = $('#tsWrap'), avail = Math.max(200, (wrap.clientWidth || 272) - 2);
  const disp = Math.max(avail / tsImg.width, 28 / tm.tw), sc = Math.max(1, Math.ceil(disp)); // tile na tela com no mínimo ~28 px para dar para tocar
  c.width = tsImg.width * sc; c.height = tsImg.height * sc; c.style.width = Math.round(tsImg.width * disp) + 'px'; c.style.height = Math.round(tsImg.height * disp) + 'px';
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(tsImg, 0, 0, c.width, c.height);
  x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 1; x.beginPath(); for (let i = 1; i < tsCols; i++) { x.moveTo(i * tm.tw * sc + .5, 0); x.lineTo(i * tm.tw * sc + .5, c.height); } for (let j = 1; j < tsRows; j++) { x.moveTo(0, j * tm.th * sc + .5); x.lineTo(c.width, j * tm.th * sc + .5); } x.stroke();
  x.strokeStyle = cssRgb('--plum'); x.lineWidth = 2; x.strokeRect(ts.sel.x * tm.tw * sc + 1, ts.sel.y * tm.th * sc + 1, ts.sel.w * tm.tw * sc - 2, ts.sel.h * tm.th * sc - 2);
  const tileOf = (e) => { const r = c.getBoundingClientRect(), s = r.width / tsImg.width; return [clamp(Math.floor((e.clientX - r.left) / (tm.tw * s)), 0, tsCols - 1), clamp(Math.floor((e.clientY - r.top) / (tm.th * s)), 0, tsRows - 1)]; };
  c.onpointerdown = (e) => { if (e.pointerType === 'touch' && !e.isPrimary) return; const [tx, ty] = tileOf(e);
    if (tm.layers[ts.layer].auto && ts.slot >= 0) { tPush(); tm.layers[ts.layer].rules[ts.slot] = ty * tsCols + tx; ts.slot = (ts.slot + 1) % 16; mapDirty = true; renderAuto(); tRender(); tSave(); ts.sel = { x: tx, y: ty, w: 1, h: 1 }; renderTileset(); return; }
    tsDrag = [tx, ty]; ts.sel = { x: tx, y: ty, w: 1, h: 1 }; c.setPointerCapture(e.pointerId); redrawSel(); if (ts.tool !== 'stamp' && ts.tool !== 'fill' && ts.tool !== 'rect') setTTool('stamp'); };
  c.onpointermove = (e) => { if (!tsDrag || !e.buttons) return; const [tx, ty] = tileOf(e); ts.sel = { x: Math.min(tsDrag[0], tx), y: Math.min(tsDrag[1], ty), w: Math.abs(tx - tsDrag[0]) + 1, h: Math.abs(ty - tsDrag[1]) + 1 }; redrawSel(); };
  c.onpointerup = c.onpointercancel = () => { if (tsDrag) { tsDrag = null; renderTSideHint(); } };
  function redrawSel() { x.clearRect(0, 0, c.width, c.height); x.drawImage(tsImg, 0, 0, c.width, c.height); x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 1; x.beginPath(); for (let i = 1; i < tsCols; i++) { x.moveTo(i * tm.tw * sc + .5, 0); x.lineTo(i * tm.tw * sc + .5, c.height); } for (let j = 1; j < tsRows; j++) { x.moveTo(0, j * tm.th * sc + .5); x.lineTo(c.width, j * tm.th * sc + .5); } x.stroke(); x.strokeStyle = cssRgb('--plum'); x.lineWidth = 2; x.strokeRect(ts.sel.x * tm.tw * sc + 1, ts.sel.y * tm.th * sc + 1, ts.sel.w * tm.tw * sc - 2, ts.sel.h * tm.th * sc - 2); }
}
const renderTSideHint = () => { const h = $('#tb-tileset .hint'); if (h) h.textContent = `${tsCols * tsRows} tiles · toque num tile ou arraste para selecionar vários (vira um carimbo). Seleção: ${ts.sel.w}×${ts.sel.h}.`; renderTileset(); };
$('#tSide').addEventListener('click', async (e) => {
  const tg = e.target.closest('[data-ttoggle]'); if (tg && !e.target.closest('.acts')) { const id = tg.dataset.ttoggle, card = tg.parentElement; card.classList.toggle('closed'); tCardOpen[id] = !card.classList.contains('closed'); LS.set('tcards', tCardOpen); if (id === 'tileset') renderTileset(); return; }
  const br = e.target.closest('[data-tbr]'); if (br) { setTBrush(+br.dataset.tbr); return; }
  const sz = e.target.closest('[data-ts]'); if (sz) { const n = +sz.dataset.ts; if (n === tm.tw && n === tm.th) return; tPush(); tm.tw = tm.th = n; loadTsImage(() => { ts.sel = { x: 0, y: 0, w: 1, h: 1 }; renderTSide(); tFit(); tSave(); }); return; }
  const ms = e.target.closest('[data-ms]'); if (ms) { const n = +ms.dataset.ms; tResizeMap(n, n); return; }
  const sl = e.target.closest('[data-slot]'); if (sl) { ts.slot = +sl.dataset.slot; renderAuto(); toast('Agora toque no tile do tileset para essa combinação'); return; }
  const vis = e.target.closest('[data-tvis]'); if (vis) { tPush(); const L = tm.layers[+vis.dataset.tvis]; L.visible = !L.visible; mapDirty = true; renderTLayers(); tRender(); tSave(); return; }
  const row = e.target.closest('[data-tli]'); if (row) { const i = +row.dataset.tli; if (i !== ts.layer) { ts.layer = i; ts.slot = -1; renderTSide(); tRender(); } return; }
  const b = e.target.closest('[data-tp]'); if (!b) return; const k = b.dataset.tp, L = tm.layers[ts.layer];
  if (k === 'tsImport') { const f = await pickFile('image/png,image/gif,image/webp,image/jpeg'); if (f) { try { setTileset(await withBusy('Abrindo tileset…', () => fileToImage(f)), f.name.replace(/\.[^.]+$/, '')); } catch (er) { toast(er.message); } } }
  else if (k === 'tsEditor') { setTileset(doc.frames.length > 1 ? sheetImage() : composite(cur.frame), doc.name); }
  else if (k === 'tsDemo') setTileset(demoTileset(), 'exemplo', 16);
  else if (k === 'tResize') tResizeMap(clamp(parseInt($('#tMw').value) || tm.mw, 1, 256), clamp(parseInt($('#tMh').value) || tm.mh, 1, 256));
  else if (k === 'tAdd') addTLayer(false); else if (k === 'tAddAuto') { addTLayer(true); toast('Camada de autotile: defina as regras no card abaixo'); }
  else if (k === 'tDel') { if (tm.layers.length <= 1) return toast('Precisa ter ao menos uma camada'); tPush(); tm.layers.splice(ts.layer, 1); ts.layer = Math.max(0, ts.layer - 1); mapDirty = true; renderTSide(); tRender(); tSave(); }
  else if (k === 'tUp' || k === 'tDown') { const j = ts.layer + (k === 'tUp' ? 1 : -1); if (j < 0 || j >= tm.layers.length) return; tPush(); [tm.layers[ts.layer], tm.layers[j]] = [tm.layers[j], tm.layers[ts.layer]]; ts.layer = j; mapDirty = true; renderTLayers(); tRender(); tSave(); }
  else if (k === 'tRen') { const f = await modal('Renomear camada', `<input class="input-field" id="tln" value="${esc(L.name)}">`, [['Cancelar', null], ['Salvar', '__form', 'primary']]); if (f) { L.name = $('#tln', f).value.trim() || L.name; renderTLayers(); tRender(); tSave(); } }
  else if (k === 'autoFill') { tPush(); const t = ts.sel.y * tsCols + ts.sel.x; L.rules.fill(t); mapDirty = true; renderAuto(); tRender(); tSave(); }
  else if (k === 'autoClear') { tPush(); L.rules.fill(-1); mapDirty = true; renderAuto(); tRender(); tSave(); }
});
function tResizeMap(W, H) { if (W === tm.mw && H === tm.mh) return; tPush(); const ox = 0, oy = 0;
  tm.layers.forEach(L => { const nd = new Int32Array(W * H).fill(-1), nc = L.auto ? new Uint8Array(W * H) : null; for (let y = 0; y < Math.min(H, tm.mh); y++) for (let x = 0; x < Math.min(W, tm.mw); x++) { nd[y * W + x] = L.data[y * tm.mw + x]; if (nc) nc[y * W + x] = L.cells[y * tm.mw + x]; } L.data = nd; if (nc) L.cells = nc; });
  tm.mw = W; tm.mh = H; mapDirty = true; renderTSide(); tFit(); tSave(); toast(`Mapa ${W}×${H} tiles (⌘Z desfaz)`); }

/* ---------- arquivos e exportação ---------- */
const tSerialize = () => ({ app: 'snapforge-tilemap', schema: 1, version: VERSION, name: tm.name, tw: tm.tw, th: tm.th, mw: tm.mw, mh: tm.mh, tileset: tm.tileset,
  layers: tm.layers.map(L => ({ name: L.name, visible: L.visible, auto: L.auto, data: Array.from(L.data), cells: L.cells ? Array.from(L.cells) : undefined, rules: L.rules })) });
function tDeserialize(o) {
  if (!o || o.app !== 'snapforge-tilemap' || !Array.isArray(o.layers)) throw new Error('Arquivo não é um mapa do Snapforge');
  const mw = clamp(o.mw | 0, 1, 256), mh = clamp(o.mh | 0, 1, 256), n = mw * mh;
  tm = { name: String(o.name || 'Mapa'), tw: clamp(o.tw | 0 || 16, 1, 256), th: clamp(o.th | 0 || 16, 1, 256), mw, mh, tileset: o.tileset && typeof o.tileset.url === 'string' && /^data:image\/(png|gif|webp|jpeg);base64,/.test(o.tileset.url) ? { name: String(o.tileset.name || 'tileset'), url: o.tileset.url, w: o.tileset.w | 0, h: o.tileset.h | 0 } : null,
    layers: o.layers.map((L, i) => ({ name: String(L.name || 'Camada ' + (i + 1)), visible: L.visible !== false, auto: !!L.auto, data: Int32Array.from((L.data || []).slice(0, n).concat(new Array(Math.max(0, n - (L.data || []).length)).fill(-1))),
      cells: L.auto ? Uint8Array.from((L.cells || []).slice(0, n).concat(new Array(Math.max(0, n - (L.cells || []).length)).fill(0))) : undefined, rules: L.auto ? (Array.isArray(L.rules) && L.rules.length === 16 ? L.rules.map(r => r | 0) : new Array(16).fill(-1)) : undefined })) };
  if (!tm.layers.length) addTLayer(false, 'Chão', true); ts.layer = 0; mapDirty = true;
}
let tSaveT = 0; function tSave() { clearTimeout(tSaveT); tSaveT = setTimeout(() => { tSaveT = 0; if (!LS.set('tilemap', tSerialize())) toast('Mapa grande demais para salvar sozinho — use Salvar'); }, 500); }
function resolvedLayer(L) { const out = new Int32Array(tm.mw * tm.mh); for (let i = 0; i < out.length; i++) out[i] = tileAt(L, i); return out; }
function mapImage() { rebuildMap(); const x = mapOff.getContext('2d'); return { width: mapOff.width, height: mapOff.height, data: x.getImageData(0, 0, mapOff.width, mapOff.height).data }; }
// ZIP sem compressão (store), suficiente para juntar mapa + tileset num arquivo só
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zipStore(files) { const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const f of files) { const name = enc.encode(f.name), data = f.data, crc = crc32(data), lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, data); const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name); off += 30 + name.length + data.length; }
  const csz = central.reduce((a, b) => a + b.length, 0), end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csz, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' }); }
const tSlug = () => (tm.name || 'mapa').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'mapa';
async function tFile(v) {
  if (v === 'save') saveBlob(new Blob([JSON.stringify(tSerialize())], { type: 'application/json' }), `${tSlug()}.tilemap.json`);
  else if (v === 'open') { const f = await pickFile('.json,application/json'); if (!f) return; try { const o = JSON.parse(await f.text()), back = tSnap(), hist0 = tHist.slice(); tDeserialize(o); tHist.length = 0; tHist.push(...hist0, back); tFuture.length = 0; loadTsImage(() => { renderTSide(); tFit(); tSave(); }); toast('Mapa aberto (⌘Z volta ao anterior)'); } catch (er) { toast(er.message || 'Arquivo inválido'); } }
  else if (v === 'new') { const f = await modal('Novo mapa', `<label class="lbl">Nome<input class="input-field" id="tmN" value="Mapa"></label><div class="lbl">Tamanho (em tiles)<div class="chips" id="tmS" data-radio>${SIZES.map(s => `<button data-n="${s}" class="${s === 32 ? 'on' : ''}">${s}</button>`).join('')}</div></div><p class="hint">O tileset atual é mantido.</p>`, [['Cancelar', null], ['Criar', '__form', 'primary']]);
    if (!f) return; const n = +($('#tmS .on', f)?.dataset.n || 32); tPush(); const back = tHist.slice(); newMap(n, n, tm.tw, tm.th, $('#tmN', f).value.trim()); tHist.push(...back); renderTSide(); tFit(); tSave(); }
  else if (v === 'export') {
    const f = await modal('Exportar mapa', `<div class="note"><strong>Tiled (.tmj)</strong> é o formato aberto que o Godot (plugin YATI) e o Unity (SuperTiled2Unity) importam. Vem num .zip com o tileset. Camadas de autotile saem já resolvidas em tiles.</div>
      <label class="lbl">Formato<select class="input-field" id="exF"><option value="tmj">Tiled (.tmj + tileset.png, em .zip)</option><option value="png">Imagem PNG do mapa</option><option value="json">JSON simples (matriz de índices)</option></select></label>
      <label class="lbl">Escala do PNG<select class="input-field" id="exS">${[1, 2, 3, 4, 8].map(s => `<option value="${s}">${s}×</option>`).join('')}</select></label>`, [['Cancelar', null], ['Exportar', '__form', 'primary']]);
    if (!f) return; const fmt = $('#exF', f).value, sc = +$('#exS', f).value;
    if (!tsImg) return toast('Importe um tileset primeiro');
    await withBusy('Exportando mapa…', async () => {
      if (fmt === 'png') { saveBlob(await canvasBlob(scaled(mapImage(), sc)), `${tSlug()}_${tm.mw * tm.tw}x${tm.mh * tm.th}${sc > 1 ? '_' + sc + 'x' : ''}.png`); return; }
      const layers = tm.layers.map(L => ({ name: L.name, visible: L.visible, data: resolvedLayer(L) }));
      if (fmt === 'json') { saveBlob(new Blob([JSON.stringify({ tileWidth: tm.tw, tileHeight: tm.th, width: tm.mw, height: tm.mh, tilesetColumns: tsCols, note: 'índice do tile = linha * tilesetColumns + coluna; -1 = vazio; data em linhas (y * width + x)', layers: layers.map(L => ({ name: L.name, visible: L.visible, data: Array.from(L.data) })) }, null, 1)], { type: 'application/json' }), `${tSlug()}.json`); return; }
      const tmj = { compressionlevel: -1, width: tm.mw, height: tm.mh, infinite: false, orientation: 'orthogonal', renderorder: 'right-down', tilewidth: tm.tw, tileheight: tm.th, type: 'map', version: '1.10', tiledversion: '1.10.2', nextlayerid: layers.length + 1, nextobjectid: 1,
        layers: layers.map((L, i) => ({ id: i + 1, name: L.name, type: 'tilelayer', visible: L.visible, opacity: 1, x: 0, y: 0, width: tm.mw, height: tm.mh, data: Array.from(L.data, t => t + 1) })),
        tilesets: [{ firstgid: 1, name: tm.tileset.name || 'tileset', image: 'tileset.png', imagewidth: tsImg.width, imageheight: tsImg.height, tilewidth: tm.tw, tileheight: tm.th, columns: tsCols, tilecount: tsCols * tsRows, margin: 0, spacing: 0 }] };
      const tsBytes = new Uint8Array(await (await fetch(tm.tileset.url)).arrayBuffer()), enc = new TextEncoder();
      saveBlob(zipStore([{ name: `${tSlug()}.tmj`, data: enc.encode(JSON.stringify(tmj, null, 1)) }, { name: 'tileset.png', data: tsBytes }]), `${tSlug()}_tiled.zip`);
    });
  }
}
$('#v-tile .stage-bar').addEventListener('click', (e) => { const b = e.target.closest('[data-tf]'); if (b) tFile(b.dataset.tf); });
function initTilemap() {
  try { const o = LS.get('tilemap', null); if (o) tDeserialize(o); else newMap(32, 32, 16, 16); } catch { newMap(32, 32, 16, 16); }
  if (!tm.tileset) { const img = demoTileset(); tm.tw = tm.th = 16; tm.tileset = { name: 'exemplo', url: imgToCanvas(img).toDataURL('image/png'), w: img.width, h: img.height }; }
  loadTsImage(() => { renderTSide(); tRender(); });
  let lastTW = 0; new ResizeObserver(() => { if (!viewOn('tile')) return; const w = tArea.clientWidth; tResize(); if (lastTW && Math.abs(w - lastTW) > 60) tFit(); lastTW = w; }).observe(tArea);
}
