/* ======================================================================
   VFX — aba: escolher efeito, ajustar, tocar, exportar ou abrir no editor
   ====================================================================== */
const VX_DEF = { id: 'blast', size: 64, frames: 0, speed: 1, scale: 1, dens: 1, glow: .6, seed: 1, hard: false, flipH: false, flipV: false, rot: 0, usePal: false, ramps: {} };
const VX = Object.assign({}, VX_DEF, LS.get('vfx', {}));
if (!VFX.some(d => d.id === VX.id)) VX.id = VX_DEF.id;
const VX_SIZES = [32, 48, 64, 96, 128, 192];
let vRes = null, vCur = 0, vPlaying = true, vLast = 0, vQ = 0, vCat = null;
const vDef = () => VFX.find(d => d.id === VX.id) || VFX[0];
const vSlug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
function vOpts(def, over) {
  return Object.assign({ size: VX.size, frames: VX.frames || def.frames, speed: VX.speed, scale: VX.scale, dens: VX.dens, glow: VX.glow, seed: VX.seed, hard: VX.hard, flipH: VX.flipH, flipV: VX.flipV, rot: VX.rot,
    ramps: VX.ramps[def.id], pal: VX.usePal ? palList(palName).map(hex2rgb) : null }, over);
}
function vfxRun() {
  const def = vDef(); vRes = vfxRender(def, vOpts(def)); vCur = clamp(vCur, 0, vRes.frames.length - 1);
  $('#xName').textContent = def.name; $('#xInfo').textContent = `· ${VX.size}×${VX.size} · ${vRes.frames.length} quadros · ${vRes.fps} fps${def.loop ? ' · laço' : ''}`;
  vStrip(); vShow(); LS.set('vfx', VX);
}
const vfxQueue = () => { clearTimeout(vQ); vQ = setTimeout(vfxRun, 50); };
function vShow() { if (!vRes) return; const f = vRes.frames[vCur]; drawToPane($('#xCv'), f); $('#xFrame').textContent = `${vCur + 1}/${vRes.frames.length}`; $$('#xStrip canvas').forEach((c, i) => c.classList.toggle('on', i === vCur)); }
function vStrip() { const st = $('#xStrip'); st.innerHTML = ''; vRes.frames.forEach((f, i) => { const c = document.createElement('canvas'); c.title = `Quadro ${i + 1}`; drawToPane(c, f); c.dataset.i = i; st.appendChild(c); }); }
$('#xStrip').addEventListener('click', (e) => { const c = e.target.closest('canvas'); if (!c) return; vCur = +c.dataset.i; vSetPlay(false); vShow(); });
function vSetPlay(on) { vPlaying = on; $('#xPlay').innerHTML = ico(on ? 'pause' : 'play'); }
function vStep(d) { if (!vRes) return; const n = vRes.frames.length; vCur = d === 'first' ? 0 : d === 'last' ? n - 1 : (vCur + d + n) % n; vShow(); }
$('#xPlayer').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (!b) return; const p = b.dataset.p; if (p === 'play') vSetPlay(!vPlaying); else { vSetPlay(false); vStep(p === 'prev' ? -1 : p === 'next' ? 1 : p); } });
(function loop(t) { if (vPlaying && vRes && viewOn('vfx') && t - vLast >= 1000 / vRes.fps) { vLast = t; vStep(1); } requestAnimationFrame(loop); })(0);

/* ---------- lista de efeitos ---------- */
const vThumbs = {};
function vThumb(def) { if (!vThumbs[def.id]) { const r = vfxRender(def, { size: 32, frames: def.frames, seed: 1, dens: 1, glow: .6, scale: 1 }); vThumbs[def.id] = r.frames[Math.floor(r.frames.length * (def.loop ? 0 : .3))]; } return vThumbs[def.id]; }
function renderVList() {
  vCat = vCat || vDef().cat;
  $('#xCats').innerHTML = VCATS.map(c => `<button data-cat="${esc(c)}" class="${c === vCat ? 'on' : ''}">${esc(c)}</button>`).join('');
  const box = $('#xList'); box.innerHTML = '';
  for (const d of VFX.filter(d => d.cat === vCat)) { const b = document.createElement('button'); b.dataset.fx = d.id; b.className = d.id === VX.id ? 'on' : ''; const c = document.createElement('canvas'); drawToPane(c, vThumb(d)); b.append(c, document.createTextNode(d.name)); box.appendChild(b); }
}
$('#xCats').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { vCat = b.dataset.cat; renderVList(); } });
$('#xList').addEventListener('click', (e) => { const b = e.target.closest('[data-fx]'); if (!b) return; vfxSelect(b.dataset.fx); });
function vfxSelect(id) { VX.id = id; VX.frames = 0; vCur = 0; vSetPlay(true); $$('#xList [data-fx]').forEach(x => x.classList.toggle('on', x.dataset.fx === id)); renderVCtl(); renderVCols(); vfxRun(); }
function vfxVariation() { VX.seed = 1 + Math.floor(Math.random() * 99999); renderVCtl(); vfxRun(); }
$('#xVar').onclick = vfxVariation;

/* ---------- ajustes ---------- */
const VSL = [['frames', 'Quadros', 2, 48, 1, (v) => v], ['speed', 'Velocidade', 25, 300, 5, (v) => v + '%', 100], ['scale', 'Escala', 40, 200, 5, (v) => v + '%', 100], ['dens', 'Densidade', 25, 250, 5, (v) => v + '%', 100], ['glow', 'Brilho', 0, 100, 5, (v) => v + '%', 100]];
function renderVCtl() {
  const def = vDef(), val = (k, m) => k === 'frames' ? (VX.frames || def.frames) : Math.round(VX[k] * m);
  $('#xCtl').innerHTML = `<div class="lbl">Tamanho do quadro<div class="chips" id="xSize">${VX_SIZES.map(s => `<button data-s="${s}" class="${s === VX.size ? 'on' : ''}">${s}</button>`).join('')}</div></div>` +
    VSL.map(([k, l, mn, mx, st, f, m = 1]) => `<label class="xrow">${l}<input type="range" data-xk="${k}" min="${mn}" max="${mx}" step="${st}" value="${val(k, m)}"><b data-xv="${k}">${f(val(k, m))}</b></label>`).join('') +
    `<label class="xrow">Variação<input class="input-field" id="xSeed" inputmode="numeric" value="${VX.seed}"><span></span></label>
     <div class="row wrap"><label class="chk"><input type="checkbox" id="xHard"${VX.hard ? ' checked' : ''}> Alfa duro (sem transparência parcial)</label>
     <label class="chk"><input type="checkbox" id="xPal"${VX.usePal ? ' checked' : ''}> Usar a paleta do editor</label></div>
     <div class="row wrap"><div class="seg" id="xFlip"><button data-fl="flipH" class="${VX.flipH ? 'on' : ''}" title="Espelhar na horizontal"><i data-ic="flipH"></i></button><button data-fl="flipV" class="${VX.flipV ? 'on' : ''}" title="Espelhar na vertical"><i data-ic="flipH"></i></button></div>
     <div class="seg" id="xRot">${[0, 1, 2, 3].map(r => `<button data-r="${r}" class="${VX.rot === r ? 'on' : ''}" title="Girar ${r * 90}°">${r * 90}°</button>`).join('')}</div>
     <button class="btn sm" id="xReset">Restaurar</button></div>`;
  paintIcons();
}
const vCtl = $('#xCtl');
vCtl.addEventListener('input', (e) => { const r = e.target.closest('[data-xk]'); if (!r) return; const k = r.dataset.xk, d = VSL.find(x => x[0] === k), m = d[6] || 1; VX[k] = k === 'frames' ? +r.value : +r.value / m; $(`[data-xv="${k}"]`).textContent = d[5](+r.value); vfxQueue(); });
vCtl.addEventListener('change', (e) => {
  if (e.target.id === 'xSeed') { VX.seed = clamp(parseInt(e.target.value) || 1, 1, 999999); e.target.value = VX.seed; vfxRun(); }
  else if (e.target.id === 'xHard') { VX.hard = e.target.checked; vfxRun(); }
  else if (e.target.id === 'xPal') { VX.usePal = e.target.checked; vfxRun(); }
});
vCtl.addEventListener('click', (e) => {
  const s = e.target.closest('[data-s]'), fl = e.target.closest('[data-fl]'), r = e.target.closest('[data-r]');
  if (s) { VX.size = +s.dataset.s; renderVCtl(); vfxRun(); }
  else if (fl) { VX[fl.dataset.fl] = !VX[fl.dataset.fl]; fl.classList.toggle('on', VX[fl.dataset.fl]); vfxRun(); }
  else if (r) { VX.rot = +r.dataset.r; $$('#xRot button').forEach(b => b.classList.toggle('on', b === r)); vfxRun(); }
  else if (e.target.closest('#xReset')) { const { id, ramps } = VX; Object.assign(VX, VX_DEF, { id, ramps: Object.assign({}, ramps, { [id]: undefined }) }); renderVCtl(); renderVCols(); vfxRun(); }
});

/* ---------- cores (rampas) ---------- */
function renderVCols() {
  const def = vDef(), cur = VX.ramps[def.id] || def.ramps;
  $('#xCols').innerHTML = def.ramps.map((r0, j) => `${def.ramps.length > 1 ? `<div class="lbl">${j === def.smoke ? 'Fumaça' : 'Cor ' + (j + 1)}</div>` : ''}<div class="xramps" data-slot="${j}">${Object.keys(VFX_RAMPS).map(n => `<button data-ramp="${esc(n)}" class="${(cur[j] || r0) === n ? 'on' : ''}"><span class="sw">${VFX_RAMPS[n].map(c => `<i style="background:${c}"></i>`).join('')}</span>${esc(n)}</button>`).join('')}</div>`).join('') +
    `<p class="hint">Cada efeito usa degraus de uma rampa de cor, do escuro ao claro. Com "Usar a paleta do editor", as cores são trocadas pelas mais próximas da paleta atual.</p>`;
}
$('#xCols').addEventListener('click', (e) => { const b = e.target.closest('[data-ramp]'); if (!b) return; const def = vDef(), j = +b.closest('[data-slot]').dataset.slot, arr = (VX.ramps[def.id] || def.ramps).slice(); arr[j] = b.dataset.ramp; VX.ramps[def.id] = arr;
  b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); vfxRun(); });

/* ---------- editor ---------- */
function vfxToEditor() {
  if (!vRes) return; const def = vDef(), back = snap(), S = VX.size;
  newDoc(S, S, def.name); hist.push(back); doc.fps = clamp(vRes.fps, 1, 60); doc.frames = vRes.frames.map(f => [new Uint8ClampedArray(f.data)]);
  showView('editor'); requestAnimationFrame(() => { fit(); fullRefresh(); }); toast(`${vRes.frames.length} quadros no editor (⌘Z desfaz)`);
}
$('#xToEd').onclick = vfxToEditor;

/* ---------- exportar ---------- */
function vSheet(frames, cols) { const S = frames[0].width, n = frames.length, rows = Math.ceil(n / cols), W = S * cols, H = S * rows, d = new Uint8ClampedArray(W * H * 4);
  frames.forEach((f, i) => { const ox = (i % cols) * S, oy = Math.floor(i / cols) * S; for (let y = 0; y < S; y++) d.set(f.data.subarray(y * S * 4, (y + 1) * S * 4), ((oy + y) * W + ox) * 4); }); return { width: W, height: H, data: d }; }
const vPng = async (img, sc) => new Uint8Array(await (await canvasBlob(scaled(img, sc))).arrayBuffer());
function vMeta(def, r, sc, extra) { return JSON.stringify(Object.assign({ app: 'snapforge-vfx', version: VERSION, effect: def.name, frameWidth: VX.size * sc, frameHeight: VX.size * sc, frames: r.frames.length, fps: r.fps, loop: !!def.loop, seed: VX.seed }, extra), null, 2); }
function vGodot(name, def, r, sc) { const S = VX.size * sc, n = r.frames.length;
  let s = `[gd_resource type="SpriteFrames" load_steps=${n + 2} format=3]\n\n[ext_resource type="Texture2D" path="res://${name}.png" id="1_tex"]\n\n`;
  for (let i = 0; i < n; i++) s += `[sub_resource type="AtlasTexture" id="AtlasTexture_${i}"]\natlas = ExtResource("1_tex")\nregion = Rect2(${i * S}, 0, ${S}, ${S})\n\n`;
  s += `[resource]\nanimations = [{\n"frames": [${Array.from({ length: n }, (_, i) => `{\n"duration": 1.0,\n"texture": SubResource("AtlasTexture_${i}")\n}`).join(', ')}],\n"loop": ${def.loop ? 'true' : 'false'},\n"name": &"${name}",\n"speed": ${r.fps}.0\n}]\n`; return s; }
async function vfxExport() {
  if (!vRes) return; const def = vDef();
  const f = await modal('Exportar efeito', `<label class="lbl">Formato<select class="input-field" id="xeF">
      <option value="strip">Tira PNG (quadros lado a lado)</option><option value="grid">Grade PNG</option><option value="gif">GIF animado (transparência dura)</option>
      <option value="zip">Quadros PNG + JSON (.zip)</option><option value="godot">Godot 4 — SpriteFrames (.zip)</option><option value="cat">Toda a categoria "${esc(def.cat)}" (.zip)</option></select></label>
    <div class="lbl">Ampliar (vizinho mais próximo, pixels nítidos)<div class="chips" id="xeS" data-radio>${[1, 2, 3, 4].map(s => `<button data-n="${s}" class="${s === 1 ? 'on' : ''}">${s}×</button>`).join('')}</div></div>
    <p class="hint">Godot: descompacte na raiz do projeto e arraste o .tres para um AnimatedSprite2D. No GIF, brilho e fumaça translúcidos viram pixels cheios ou vazios.</p>`, [['Cancelar', null], ['Exportar', '__form', 'primary']]);
  if (!f) return; const fmt = $('#xeF', f).value, sc = +($('#xeS .on', f)?.dataset.n || 1), name = vSlug(def.name) + '_' + VX.size + (sc > 1 ? '_' + sc + 'x' : ''), enc = new TextEncoder();
  await withBusy('Exportando…', async () => {
    const r = vRes;
    if (fmt === 'strip') saveBlob(await canvasBlob(scaled(vSheet(r.frames, r.frames.length), sc)), `${name}_tira.png`);
    else if (fmt === 'grid') saveBlob(await canvasBlob(scaled(vSheet(r.frames, Math.ceil(Math.sqrt(r.frames.length))), sc)), `${name}_grade.png`);
    else if (fmt === 'gif') saveBlob(gifEncode(r.frames.map(fr => sc > 1 ? vUp(fr, sc) : fr), Math.round(100 / r.fps)), `${name}.gif`);
    else if (fmt === 'zip') { const files = []; for (let i = 0; i < r.frames.length; i++) files.push({ name: `${name}_${String(i).padStart(2, '0')}.png`, data: await vPng(r.frames[i], sc) }); files.push({ name: `${name}.json`, data: enc.encode(vMeta(def, r, sc)) }); saveBlob(zipStore(files), `${name}.zip`); }
    else if (fmt === 'godot') { const n = vSlug(def.name); saveBlob(zipStore([{ name: `${n}.png`, data: await vPng(vSheet(r.frames, r.frames.length), sc) }, { name: `${n}.tres`, data: enc.encode(vGodot(n, def, r, sc)) }]), `${n}_godot.zip`); }
    else if (fmt === 'cat') { const files = []; for (const d of VFX.filter(x => x.cat === def.cat)) { const rr = vfxRender(d, vOpts(d, { frames: d.frames, ramps: VX.ramps[d.id] })), n = vSlug(d.name); files.push({ name: `${n}.png`, data: await vPng(vSheet(rr.frames, rr.frames.length), sc) }, { name: `${n}.json`, data: enc.encode(vMeta(d, rr, sc)) }); } saveBlob(zipStore(files), `${vSlug(def.cat)}_${VX.size}.zip`); }
  }, def.name);
}
$('#xExport').onclick = vfxExport;
function vUp(img, s) { const W = img.width * s, H = img.height * s, d = new Uint8ClampedArray(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (Math.floor(y / s) * img.width + Math.floor(x / s)) * 4; d.set(img.data.subarray(o, o + 4), (y * W + x) * 4); } return { width: W, height: H, data: d }; }

/** GIF89a animado, laço infinito, índice 0 transparente (alfa < 128). Mais de 255 cores: reduz bits por canal até caber. */
function gifEncode(frames, delayCs) {
  const w = frames[0].width, h = frames[0].height; let shift = 0, map;
  for (;;) { map = new Map(); let over = false; for (const f of frames) { const d = f.data; for (let i = 0; i < d.length && !over; i += 4) if (d[i + 3] >= 128) { const k = ((d[i] >> shift) << 16) | ((d[i + 1] >> shift) << 8) | (d[i + 2] >> shift); if (!map.has(k)) { if (map.size >= 255) over = true; else map.set(k, map.size + 1); } } } if (!over) break; shift++; }
  const out = [], b = (...v) => out.push(...v), w16 = (v) => b(v & 255, v >> 8), half = shift ? 1 << (shift - 1) : 0;
  for (const c of 'GIF89a') b(c.charCodeAt(0)); w16(w); w16(h); b(0xf7, 0, 0);
  const gct = new Uint8Array(768); for (const [k, i] of map) { gct[i * 3] = ((k >> 16 & 255) << shift) | half; gct[i * 3 + 1] = ((k >> 8 & 255) << shift) | half; gct[i * 3 + 2] = ((k & 255) << shift) | half; } b(...gct);
  b(0x21, 0xff, 11); for (const c of 'NETSCAPE2.0') b(c.charCodeAt(0)); b(3, 1, 0, 0, 0);
  for (const f of frames) {
    const d = f.data, idx = new Uint8Array(w * h); for (let p = 0, i = 0; p < idx.length; p++, i += 4) idx[p] = d[i + 3] >= 128 ? map.get(((d[i] >> shift) << 16) | ((d[i + 1] >> shift) << 8) | (d[i + 2] >> shift)) : 0;
    b(0x21, 0xf9, 4, 0x09); w16(Math.max(2, delayCs)); b(0, 0); b(0x2c); w16(0); w16(0); w16(w); w16(h); b(0, 8);
    const data = lzwGif(idx, 8); for (let i = 0; i < data.length; i += 255) { const n = Math.min(255, data.length - i); out.push(n); for (let j = 0; j < n; j++) out.push(data[i + j]); } b(0);
  }
  b(0x3b); return new Blob([new Uint8Array(out)], { type: 'image/gif' });
}
function lzwGif(ix, min) {
  const clear = 1 << min, eoi = clear + 1, bytes = []; let size = min + 1, next = eoi + 1, dict = new Map(), cur = 0, nb = 0;
  const put = (c) => { cur |= c << nb; nb += size; while (nb >= 8) { bytes.push(cur & 255); cur >>>= 8; nb -= 8; } };
  const emit = (c) => { put(c); if (next >= (1 << size) && size < 12) size++; };
  put(clear); let pre = ix[0];
  for (let i = 1; i < ix.length; i++) { const k = ix[i], key = pre << 8 | k, hit = dict.get(key); if (hit !== undefined) { pre = hit; continue; }
    emit(pre); if (next < 4096) dict.set(key, next++); else { put(clear); dict = new Map(); next = eoi + 1; size = min + 1; } pre = k; }
  emit(pre); put(eoi); if (nb > 0) bytes.push(cur & 255); return bytes;
}

function vfxKey(e) {
  const k = e.key.toLowerCase(); if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (k === ' ') { vSetPlay(!vPlaying); e.preventDefault(); } else if (k === 'arrowleft') { vSetPlay(false); vStep(-1); e.preventDefault(); } else if (k === 'arrowright') { vSetPlay(false); vStep(1); e.preventDefault(); } else if (k === 'r') vfxVariation();
}
let vfxReady = false;
function vfxShow() { if (!vfxReady) { vfxReady = true; renderVList(); renderVCtl(); renderVCols(); vSetPlay(true); vfxRun(); } }
