/* ======================= operações de camada/seleção ======================= */
function transformArea(kind) {
  if (layerBlocked()) return; const r = selRect || { x: 0, y: 0, w: doc.w, h: doc.h };
  if (kind === 'rot' && r.w !== r.h) return toast(selRect ? 'Girar exige seleção quadrada' : 'Girar exige canvas quadrado');
  pushHist(); const a = px(), src = new Uint8ClampedArray(a), w = doc.w;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { let sx = x, sy = y; if (kind === 'fh') sx = r.w - 1 - x; else if (kind === 'fv') sy = r.h - 1 - y; else { sx = y; sy = r.w - 1 - x; }
    const s = ((r.y + sy) * w + r.x + sx) * 4; a.set(src.subarray(s, s + 4), ((r.y + y) * w + r.x + x) * 4); }
  refreshAfterEdit();
}
function clearArea() { if (layerBlocked()) return; pushHist(); const a = px(); if (selRect) { for (let y = selRect.y; y < selRect.y + selRect.h; y++) for (let x = selRect.x; x < selRect.x + selRect.w; x++) if (inside(x, y)) { const o = (y * doc.w + x) * 4; a[o] = a[o + 1] = a[o + 2] = a[o + 3] = 0; } } else a.fill(0); refreshAfterEdit(); }
function autoOutline() { if (layerBlocked()) return; pushHist(); const a = px(), src = new Uint8ClampedArray(a), w = doc.w, h = doc.h, c = st.color.slice(0, 3).concat(255);
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) plotRaw(a, x, y, c);
  refreshAfterEdit(); toast('Contorno de 1 px com a cor atual'); }
let clip = null;
function copySel(cut) { const r = selRect || { x: 0, y: 0, w: doc.w, h: doc.h }, a = px(), d = new Uint8ClampedArray(r.w * r.h * 4);
  for (let y = 0; y < r.h; y++) d.set(a.subarray(((r.y + y) * doc.w + r.x) * 4, ((r.y + y) * doc.w + r.x + r.w) * 4), y * r.w * 4);
  clip = { w: r.w, h: r.h, data: d, x: r.x, y: r.y }; if (cut) clearArea(); toast(cut ? 'Recortado' : 'Copiado'); }
function pasteClip() { if (!clip) return toast('Nada copiado ainda'); if (layerBlocked()) return; pushHist(); const a = px(), x0 = clamp(selRect ? selRect.x : clip.x, 0, doc.w - 1), y0 = clamp(selRect ? selRect.y : clip.y, 0, doc.h - 1);
  for (let y = 0; y < clip.h; y++) for (let x = 0; x < clip.w; x++) { const s = (y * clip.w + x) * 4; if (!clip.data[s + 3] || !inside(x0 + x, y0 + y)) continue; a.set(clip.data.subarray(s, s + 4), ((y0 + y) * doc.w + x0 + x) * 4); }
  selRect = { x: x0, y: y0, w: Math.min(clip.w, doc.w - x0), h: Math.min(clip.h, doc.h - y0) }; setTool('move'); refreshAfterEdit(); toast('Colado — arraste para posicionar'); }
function cropToSel() { if (!selRect) return; pushHist(); const r = selRect; doc.frames = doc.frames.map(fr => fr.map(a => { const d = new Uint8ClampedArray(r.w * r.h * 4); for (let y = 0; y < r.h; y++) d.set(a.subarray(((r.y + y) * doc.w + r.x) * 4, ((r.y + y) * doc.w + r.x + r.w) * 4), y * r.w * 4); return d; }));
  doc.w = r.w; doc.h = r.h; selRect = null; fit(); fullRefresh(); }
function nudge(dx, dy) { if (layerBlocked()) return; pushHist(); const base = new Uint8ClampedArray(px()); shiftPixels(base, selRect ? { ...selRect } : null, dx, dy); refreshAfterEdit(); }

