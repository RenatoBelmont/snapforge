/* ======================= render do palco ======================= */
const cv = $('#cv'), cx = cv.getContext('2d'), area = $('#area');
const off = document.createElement('canvas'), offx = off.getContext('2d'), onionC = document.createElement('canvas');
let overlay = null, selRect = null, hover = null, raf = 0;
function resizeCanvas() { const r = area.getBoundingClientRect(), d = devicePixelRatio || 1; cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); render(); }
function fit() { const r = area.getBoundingClientRect(); if (!r.width) return; const k = st.tileMode ? 3 : 1; st.zoom = Math.max(1, Math.floor(Math.min((r.width - 32) / (doc.w * k), (r.height - 32) / (doc.h * k)))); st.ox = Math.round((r.width - doc.w * st.zoom) / 2); st.oy = Math.round((r.height - doc.h * st.zoom) / 2); render(); }
function zoomAt(nz, sx, sy) { nz = clamp(Math.round(nz), 1, 96); const k = nz / st.zoom; st.ox = sx - (sx - st.ox) * k; st.oy = sy - (sy - st.oy) * k; st.zoom = nz; render(); }
const render = () => { if (!raf) raf = requestAnimationFrame(draw); };
function draw() {
  raf = 0; const d = devicePixelRatio || 1, z = st.zoom, W = doc.w * z, H = doc.h * z;
  cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); cx.setTransform(d, 0, 0, d, 0, 0);
  const cs = getComputedStyle(document.documentElement), ca = `rgb(${cs.getPropertyValue('--check-a').trim().replace(/ /g, ',')})`, cb = `rgb(${cs.getPropertyValue('--check-b').trim().replace(/ /g, ',')})`;
  // modo tile: o desenho se repete nas 8 casas em volta (para ver se as bordas encaixam)
  const T = st.tileMode ? [[0, 0], [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] : [[0, 0]];
  const cell = Math.max(z, 8 * Math.max(1, Math.round(z / 8)));
  for (const [tx, ty] of T) { const X0 = st.ox + tx * W, Y0 = st.oy + ty * H; cx.fillStyle = cb; cx.fillRect(X0, Y0, W, H); cx.fillStyle = ca;
    cx.save(); cx.beginPath(); cx.rect(X0, Y0, W, H); cx.clip();
    for (let y = 0; y * cell < H; y++) for (let x = y % 2; x * cell < W; x += 2) cx.fillRect(X0 + x * cell, Y0 + y * cell, cell, cell);
    cx.restore(); }
  cx.imageSmoothingEnabled = false;
  if (st.onion && cur.frame > 0) { const o = composite(cur.frame - 1); onionC.width = doc.w; onionC.height = doc.h; onionC.getContext('2d').putImageData(new ImageData(o.data, doc.w, doc.h), 0, 0); cx.globalAlpha = .28; cx.drawImage(onionC, st.ox, st.oy, W, H); cx.globalAlpha = 1; }
  const comp = composite(cur.frame);
  if (overlay) for (const [i, c] of overlay) { const o = i * 4; if (c[3] === 0) comp.data[o + 3] = 0; else { comp.data[o] = c[0]; comp.data[o + 1] = c[1]; comp.data[o + 2] = c[2]; comp.data[o + 3] = Math.max(comp.data[o + 3], c[3]); } }
  off.width = doc.w; off.height = doc.h; offx.putImageData(new ImageData(comp.data, doc.w, doc.h), 0, 0); for (const [tx, ty] of T) cx.drawImage(off, st.ox + tx * W, st.oy + ty * H, W, H);
  if (T.length > 1) { cx.fillStyle = dark0() ? 'rgba(0,0,0,.22)' : 'rgba(255,255,255,.22)'; for (const [tx, ty] of T.slice(1)) cx.fillRect(st.ox + tx * W, st.oy + ty * H, W, H); }
  const dark = document.documentElement.classList.contains('dark');
  if (st.grid && z >= 6) { cx.strokeStyle = dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)'; cx.lineWidth = 1; cx.beginPath();
    for (let x = 0; x <= doc.w; x++) { const X = Math.round(st.ox + x * z) + .5; cx.moveTo(X, st.oy); cx.lineTo(X, st.oy + H); }
    for (let y = 0; y <= doc.h; y++) { const Y = Math.round(st.oy + y * z) + .5; cx.moveTo(st.ox, Y); cx.lineTo(st.ox + W, Y); } cx.stroke(); }
  if (st.majorGrid > 1 && z >= 3) { cx.strokeStyle = cssRgb('--plum', .45); cx.beginPath();
    for (let x = st.majorGrid; x < doc.w; x += st.majorGrid) { const X = Math.round(st.ox + x * z) + .5; cx.moveTo(X, st.oy); cx.lineTo(X, st.oy + H); }
    for (let y = st.majorGrid; y < doc.h; y += st.majorGrid) { const Y = Math.round(st.oy + y * z) + .5; cx.moveTo(st.ox, Y); cx.lineTo(st.ox + W, Y); } cx.stroke(); }
  if (st.mirrorX || st.mirrorY) { cx.strokeStyle = 'rgba(244,114,182,.75)'; cx.setLineDash([4, 4]); cx.beginPath(); if (st.mirrorX) { cx.moveTo(st.ox + W / 2, st.oy); cx.lineTo(st.ox + W / 2, st.oy + H); } if (st.mirrorY) { cx.moveTo(st.ox, st.oy + H / 2); cx.lineTo(st.ox + W, st.oy + H / 2); } cx.stroke(); cx.setLineDash([]); }
  if (selRect) { cx.lineWidth = 1; cx.strokeStyle = '#fff'; cx.strokeRect(st.ox + selRect.x * z + .5, st.oy + selRect.y * z + .5, selRect.w * z, selRect.h * z); cx.strokeStyle = `rgb(${cs.getPropertyValue('--plum').trim().replace(/ /g, ',')})`; cx.setLineDash([5, 4]); /* ameixa = cor de seleção do DESIGN.md */ cx.strokeRect(st.ox + selRect.x * z + .5, st.oy + selRect.y * z + .5, selRect.w * z, selRect.h * z); cx.setLineDash([]); }
  if (hover && ['pencil', 'eraser', 'line', 'rect', 'ellipse'].includes(st.tool) && !strokeActive()) {
    cx.strokeStyle = dark ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.75)'; cx.lineWidth = 1;
    for (const [a, b] of stampPoints(hover[0], hover[1])) if (inside(a, b)) cx.strokeRect(st.ox + a * z + .5, st.oy + b * z + .5, z - 1, z - 1);
  }
  cx.strokeStyle = 'rgba(128,128,140,.45)'; cx.strokeRect(st.ox - .5, st.oy - .5, W + 1, H + 1);
  const zl = $('#zoomLbl'); if (zl) zl.textContent = (z * 100) + '%';
  $('#fSize').textContent = `${doc.w}×${doc.h} · quadro ${cur.frame + 1}/${doc.frames.length} · ${doc.layers[cur.layer]?.name || ''}`;
}

/* ======================= desenho ======================= */
const inside = (x, y) => x >= 0 && y >= 0 && x < doc.w && y < doc.h;
// modo tile: o que passa de uma borda continua do outro lado
const wrapPt = (x, y) => st.tileMode ? [((x % doc.w) + doc.w) % doc.w, ((y % doc.h) + doc.h) % doc.h] : [x, y];
const inTiles = (x, y) => st.tileMode ? x >= -doc.w && y >= -doc.h && x < 2 * doc.w && y < 2 * doc.h : inside(x, y);
const dark0 = () => document.documentElement.classList.contains('dark');
function plotRaw(arr, x, y, c) { if (!inside(x, y)) return; const o = (y * doc.w + x) * 4; arr[o] = c[0]; arr[o + 1] = c[1]; arr[o + 2] = c[2]; arr[o + 3] = c[3]; }
function stampPoints(x, y) {
  const pts = [], b = st.brush, r0 = -Math.floor((b - 1) / 2);
  for (let dy = 0; dy < b; dy++) for (let dx = 0; dx < b; dx++) { if (b >= 3 && st.brushShape !== 'square' && (dx - (b - 1) / 2) ** 2 + (dy - (b - 1) / 2) ** 2 > (b / 2) ** 2) continue; pts.push([x + r0 + dx, y + r0 + dy]); }
  const all = [];
  for (const [p0, q0] of pts) { const [p, q] = wrapPt(p0, q0); all.push([p, q]); if (st.mirrorX) all.push([doc.w - 1 - p, q]); if (st.mirrorY) all.push([p, doc.h - 1 - q]); if (st.mirrorX && st.mirrorY) all.push([doc.w - 1 - p, doc.h - 1 - q]); }
  return all;
}
function linePts(x0, y0, x1, y1) { const pts = []; let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, e = dx + dy; for (;;) { pts.push([x0, y0]); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } return pts; }
function rectPts(x0, y0, x1, y1, filled) { const pts = [], a = Math.min(x0, x1), b = Math.max(x0, x1), c = Math.min(y0, y1), d = Math.max(y0, y1); for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) if (filled || x === a || x === b || y === c || y === d) pts.push([x, y]); return pts; }
function ellipsePts(x0, y0, x1, y1, filled) { const pts = [], a = Math.min(x0, x1), b = Math.max(x0, x1), c = Math.min(y0, y1), d = Math.max(y0, y1), rx = (b - a) / 2, ry = (d - c) / 2, cxp = (a + b) / 2, cyp = (c + d) / 2;
  if (rx < .5 || ry < .5) return rectPts(a, c, b, d, true); const inE = (x, y) => ((x - cxp) / (rx + .5)) ** 2 + ((y - cyp) / (ry + .5)) ** 2 <= 1;
  for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) { if (!inE(x, y)) continue; if (filled || !inE(x - 1, y) || !inE(x + 1, y) || !inE(x, y - 1) || !inE(x, y + 1)) pts.push([x, y]); } return pts; }
function floodFill(x, y, c) {
  const a = px(), w = doc.w, h = doc.h, o0 = (y * w + x) * 4, t = [a[o0], a[o0 + 1], a[o0 + 2], a[o0 + 3]];
  if (t[0] === c[0] && t[1] === c[1] && t[2] === c[2] && t[3] === c[3]) return false;
  const eq = (o) => a[o] === t[0] && a[o + 1] === t[1] && a[o + 2] === t[2] && a[o + 3] === t[3];
  if (!st.contiguous) { for (let i = 0; i < w * h; i++) if (eq(i * 4)) plotRaw(a, i % w, (i / w) | 0, c); return true; }
  const stack = [x, y], seen = new Uint8Array(w * h);
  while (stack.length) { let yy = stack.pop(), xx = stack.pop(); if (st.tileMode) [xx, yy] = wrapPt(xx, yy); if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const i = yy * w + xx; if (seen[i] || !eq(i * 4)) continue; seen[i] = 1; plotRaw(a, xx, yy, c); stack.push(xx + 1, yy, xx - 1, yy, xx, yy + 1, xx, yy - 1); }
  return true;
}
// botão direito do mouse pinta com a cor secundária (st.alt é marcado no pointerdown)
const drawColor = () => st.tool === 'eraser' ? [0, 0, 0, 0] : st.alt ? st.color2 : st.color;
const layerBlocked = () => { const L = doc.layers[cur.layer]; if (L.locked) { toast('A camada está travada'); return true; } if (!L.visible) { toast('A camada está oculta'); return true; } return false; };

let stroke = null; const strokeActive = () => !!(stroke && !stroke.noop && !stroke.pan);
function beginStroke(x, y) {
  const t = st.tool;
  // seleção não mexe nos pixels: não entra no histórico (antes apagava a pilha de refazer) e funciona em camada travada/oculta
  if (t === 'select') { stroke = { x0: x, y0: y, select: true, sel0: selRect }; selRect = null; render(); return; }
  if (layerBlocked()) { stroke = { noop: true }; return; }
  const fut = pushHist(); stroke = { x0: x, y0: y, lx: x, ly: y, base: new Uint8ClampedArray(px()), before: hist[hist.length - 1], fut, changed: false, path: [] };
  if (t === 'fill') { if (inTiles(x, y)) [x, y] = wrapPt(x, y); stroke.changed = inside(x, y) && floodFill(x, y, drawColor()); endStroke(); stroke = null; return; }
  if (t === 'pencil' || t === 'eraser') { paintPoint(x, y); render(); return; }
  if (t === 'move') { stroke.sel = selRect ? { ...selRect } : null; return; }
  moveStroke(x, y);
}
function paintPoint(x, y) {
  const c = drawColor(), a = px();
  for (const [p, q] of stampPoints(x, y)) plotRaw(a, p, q, c); stroke.changed = true;
  if (st.pixelPerfect && st.brush === 1 && st.tool === 'pencil') { // remove cantos em "L" de traços de 1 px
    const P = stroke.path, last = P[P.length - 1]; if (last && last[0] === x && last[1] === y) return; P.push([x, y]);
    if (P.length >= 3) { const A = P[P.length - 3], B = P[P.length - 2], C = P[P.length - 1];
      if (Math.abs(A[0] - C[0]) === 1 && Math.abs(A[1] - C[1]) === 1 && (B[0] === A[0] || B[1] === A[1]) && (B[0] === C[0] || B[1] === C[1])) {
        for (const [p, q] of stampPoints(B[0], B[1])) { if (!inside(p, q)) continue; const o = (q * doc.w + p) * 4; a.set(stroke.base.subarray(o, o + 4), o); }
        P.splice(P.length - 2, 1); } }
  }
}
function moveStroke(x, y) {
  if (!stroke || stroke.noop) return; const t = st.tool;
  if (t === 'pencil' || t === 'eraser') { const pts = linePts(stroke.lx, stroke.ly, x, y); for (let i = 1; i < pts.length; i++) paintPoint(pts[i][0], pts[i][1]); stroke.lx = x; stroke.ly = y; render(); return; }
  if (t === 'line' || t === 'rect' || t === 'ellipse') {
    const base = t === 'line' ? linePts(stroke.x0, stroke.y0, x, y) : t === 'rect' ? rectPts(stroke.x0, stroke.y0, x, y, st.fillShape) : ellipsePts(stroke.x0, stroke.y0, x, y, st.fillShape);
    overlay = new Map(); const c = drawColor(); for (const [a, b] of base) for (const [p, q] of stampPoints(a, b)) if (inside(p, q)) overlay.set(q * doc.w + p, c);
    stroke.changed = true; render(); return; }
  if (stroke.select) { const a = clamp(Math.min(stroke.x0, x), 0, doc.w - 1), b = clamp(Math.min(stroke.y0, y), 0, doc.h - 1); selRect = { x: a, y: b, w: clamp(Math.max(stroke.x0, x), 0, doc.w - 1) - a + 1, h: clamp(Math.max(stroke.y0, y), 0, doc.h - 1) - b + 1 }; render(); return; }
  if (t === 'move') { shiftPixels(stroke.base, stroke.sel, x - stroke.x0, y - stroke.y0); stroke.changed = x !== stroke.x0 || y !== stroke.y0; render(); }
}
function shiftPixels(src, sel, dx, dy) {
  const a = px(), w = doc.w, h = doc.h;
  if (sel) { a.set(src); for (let yy = sel.y; yy < sel.y + sel.h; yy++) for (let xx = sel.x; xx < sel.x + sel.w; xx++) { const o = (yy * w + xx) * 4; a[o] = a[o + 1] = a[o + 2] = a[o + 3] = 0; }
    for (let yy = sel.y; yy < sel.y + sel.h; yy++) for (let xx = sel.x; xx < sel.x + sel.w; xx++) { const tx = xx + dx, ty = yy + dy; if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue; const so = (yy * w + xx) * 4; a.set(src.subarray(so, so + 4), (ty * w + tx) * 4); }
    selRect = { x: sel.x + dx, y: sel.y + dy, w: sel.w, h: sel.h }; }
  else { a.fill(0); for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { let tx = xx + dx, ty = yy + dy; if (st.tileMode) [tx, ty] = wrapPt(tx, ty); if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue; const so = (yy * w + xx) * 4; a.set(src.subarray(so, so + 4), (ty * w + tx) * 4); } }
}
function endStroke() {
  if (!stroke || stroke.noop) { stroke = null; return; }
  if (overlay) { const a = px(); for (const [i, c] of overlay) { const o = i * 4; a[o] = c[0]; a[o + 1] = c[1]; a[o + 2] = c[2]; a[o + 3] = c[3]; } overlay = null; }
  if (stroke.select) { if (selRect && selRect.w * selRect.h <= 1) selRect = null; stroke = null; render(); updateBar(); return; }
  if (!stroke.changed) { hist.pop(); future.push(...stroke.fut); stroke = null; render(); updateBar(); return; } // nada mudou: o histórico fica como estava
  stroke = null; refreshAfterEdit();
}
function abortStroke() {
  if (stroke && stroke.select) selRect = stroke.sel0;
  else if (stroke && stroke.before) { restore(stroke.before); hist.pop(); future.push(...stroke.fut); overlay = null; }
  stroke = null; fullRefresh();
}
function refreshAfterEdit() { render(); renderLayers(); renderFrames(); renderFaixa(); updateBar(); markDirty(); }

/* ======================= entrada: Apple Pencil, toque, mouse ======================= */
const TOUCHES = new Map(); let PEN_DOWN = false, pinch = null, LP = null, CG = null, GEST = null, fillPend = null, panMode = false, VIEW0 = null;
const gestUndo = () => { if (!hist.length) return toast('Nada para desfazer', 900); undo(); toast('Desfeito (dois dedos)', 900); };
const gestRedo = () => { if (!future.length) return toast('Nada para refazer', 900); redo(); toast('Refeito (três dedos)', 900); };
function toPix(cx_, cy_) { const r = cv.getBoundingClientRect(); return [Math.floor((cx_ - r.left - st.ox) / st.zoom), Math.floor((cy_ - r.top - st.oy) / st.zoom)]; }
function compositeAt(x, y) { if (inTiles(x, y)) [x, y] = wrapPt(x, y); if (!inside(x, y)) return null; const c = composite(cur.frame), o = (y * doc.w + x) * 4; return [c.data[o], c.data[o + 1], c.data[o + 2], c.data[o + 3]]; }
function lupaEm(clientX, clientY) {
  const [x, y] = toPix(clientX, clientY); CG.cand = compositeAt(x, y); CG.x = clientX; CG.y = clientY;
  const L = $('#lupa'), g = $('#lupaCv').getContext('2d'), S = 264, R0 = S / 2; L.style.display = 'block';
  L.style.left = clamp(clientX - 66, 4, innerWidth - 136) + 'px'; L.style.top = (clientY - 180 < 4 ? clientY + 50 : clientY - 180) + 'px';
  g.clearRect(0, 0, S, S); g.save(); g.beginPath(); g.arc(R0, R0, R0 - 22, 0, 7); g.clip(); g.fillStyle = '#222'; g.fillRect(0, 0, S, S);
  const r = cv.getBoundingClientRect(), dpr = cv.width / r.width, src = Math.max(6, 7 * st.zoom) * dpr; g.imageSmoothingEnabled = false;
  g.drawImage(cv, (clientX - r.left) * dpr - src / 2, (clientY - r.top) * dpr - src / 2, src, src, 0, 0, S, S);
  const cel = S * st.zoom * dpr / src, ox = R0 - ((clientX - r.left) * dpr - (st.ox + x * st.zoom) * dpr) * S / src, oy = R0 - ((clientY - r.top) * dpr - (st.oy + y * st.zoom) * dpr) * S / src;
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(ox, oy, cel, cel); g.restore();
  const nova = CG.cand && CG.cand[3] ? rgb2hex(...CG.cand) : '#00000000', velha = rgb2hex(...(CG.alt ? st.color2 : st.color));
  g.lineWidth = 20; g.strokeStyle = CG.cand && CG.cand[3] ? nova : 'rgba(128,128,128,.4)'; g.beginPath(); g.arc(R0, R0, R0 - 12, Math.PI, 0); g.stroke(); g.strokeStyle = velha; g.beginPath(); g.arc(R0, R0, R0 - 12, 0, Math.PI); g.stroke();
  g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.arc(R0, R0, R0 - 2, 0, 7); g.stroke(); g.beginPath(); g.arc(R0, R0, R0 - 22, 0, 7); g.stroke();
}
function startPick(id, x, y, alt) { CG = { id, alt: !!alt }; lupaEm(x, y); }
function endPick(commit) { if (!CG) return; const c = CG.cand, alt = CG.alt; CG = null; $('#lupa').style.display = 'none'; if (commit && c && c[3] > 0 && alt) { st.color2 = c.slice(); renderColor(); renderFaixa(); return; } if (commit && c && c[3] > 0) { setColor(c); if (st.tool === 'eraser' || st.tool === 'pick') setTool('pencil'); } }
function setPenOnly(on, auto) { st.penOnly = on; st.penSeen = true; LS.set('penOnly', on); LS.set('penSeen', true); updateBar(); renderBrush(); if (auto) toast('Apple Pencil detectada: agora só a caneta pinta; o dedo move e dá zoom', 3600); }
const ehDedo = (e) => e.pointerType === 'touch' && st.penOnly;
const meio = () => { const p = [...TOUCHES.values()]; return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2, d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1 }; };

cv.addEventListener('pointerdown', (e) => {
  try { cv.setPointerCapture(e.pointerId); } catch {}
  if (e.pointerType === 'pen') { PEN_DOWN = true; pinch = null; if (stroke && stroke.pan) stroke = null; if (!st.penSeen && !st.penOnly) setPenOnly(true, true); }
  if (e.pointerType === 'touch') {
    TOUCHES.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
    if (TOUCHES.size === 1) { clearTimeout(LP && LP.t); if (GEST) gestStop(GEST); GEST = null; VIEW0 = { zoom: st.zoom, ox: st.ox, oy: st.oy };
      LP = { id: e.pointerId, x: e.clientX, y: e.clientY, t: setTimeout(() => { if (LP && TOUCHES.size === 1 && !pinch) { if (strokeActive()) abortStroke(); if (stroke && stroke.pan) stroke = null; fillPend = null; startPick(LP.id, LP.x, LP.y); LP = null; } }, 420) }; }
    else { if (LP) { clearTimeout(LP.t); LP = null; } if (CG) endPick(false); fillPend = null; if (!GEST) GEST = { t0: performance.now(), max: 0, moved: false, view: VIEW0 }; GEST.max = Math.max(GEST.max, TOUCHES.size);
      if (!PEN_DOWN) gestArm(GEST, gestUndo, gestRedo); }
    if (TOUCHES.size === 2 && !PEN_DOWN) {
      // Os dedos nunca chegam juntos: com "Dedo pinta", o 1º já começou um traço. Ele é desfeito sempre, mas só vira pinça (sem desfazer)
      // se já estava desenhando de verdade (> 250 ms ou > 14 px); senão é o começo de um toque de 2/3 dedos, como no Procreate.
      if (strokeActive()) { const f = [...TOUCHES.values()][0], longo = performance.now() - f.t0 > 250 || Math.hypot(f.x - f.x0, f.y - f.y0) > 14; abortStroke(); if (GEST && longo) GEST.moved = true; }
      stroke = null; const m = meio(), r = cv.getBoundingClientRect(); pinch = { d0: m.d, z0: st.zoom, mx: m.x - r.left, my: m.y - r.top, ox: st.ox, oy: st.oy }; return; }
    if (TOUCHES.size > 2) return;
  }
  if (pinch || PEN_DOWN && e.pointerType === 'touch') return;
  st.alt = e.pointerType === 'mouse' && e.button === 2;
  if (e.pointerType === 'mouse' && e.altKey) { startPick(e.pointerId, e.clientX, e.clientY, st.alt); return; }
  if (st.tool === 'hand' || e.button === 1 || (e.button === 2 && ['hand', 'select', 'move'].includes(st.tool)) || panMode || ehDedo(e)) { stroke = { pan: true, id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: st.ox, oy: st.oy }; return; }
  const [x, y] = toPix(e.clientX, e.clientY);
  if (st.tool === 'pick') { startPick(e.pointerId, e.clientX, e.clientY, st.alt); return; }
  if (st.tool === 'fill' && e.pointerType === 'touch') { fillPend = { id: e.pointerId, x, y }; return; }
  stroke = null; beginStroke(x, y); if (stroke) stroke.id = e.pointerId;
});
cv.addEventListener('pointermove', (e) => {
  const [x, y] = toPix(e.clientX, e.clientY); $('#fPos').textContent = inside(x, y) ? `${x}, ${y}` : '—';
  if ((e.pointerType === 'pen' || e.pointerType === 'mouse') && !e.buttons) { const h = inTiles(x, y) ? [x, y] : null; if (String(h) !== String(hover)) { hover = h; render(); } }
  if (CG && e.pointerId === CG.id) { lupaEm(e.clientX, e.clientY); return; }
  if (TOUCHES.has(e.pointerId)) { const t = TOUCHES.get(e.pointerId); t.x = e.clientX; t.y = e.clientY; const d = Math.hypot(t.x - t.x0, t.y - t.y0);
    if (LP && LP.id === e.pointerId && d > 9) { clearTimeout(LP.t); LP = null; } if (GEST && d > 14) GEST.moved = true; if (fillPend && fillPend.id === e.pointerId && d > 9) fillPend = null; }
  if (pinch && TOUCHES.size >= 2) { const m = meio(), r = cv.getBoundingClientRect(), nz = clamp(Math.round(pinch.z0 * m.d / pinch.d0), 1, 96), k = nz / pinch.z0;
    st.zoom = nz; st.ox = (m.x - r.left) - (pinch.mx - pinch.ox) * k; st.oy = (m.y - r.top) - (pinch.my - pinch.oy) * k; render(); return; }
  if (!stroke || (stroke.id != null && stroke.id !== e.pointerId)) return;
  if (stroke.pan) { st.ox = stroke.ox + e.clientX - stroke.sx; st.oy = stroke.oy + e.clientY - stroke.sy; render(); return; }
  const evs = (e.getCoalescedEvents && (st.tool === 'pencil' || st.tool === 'eraser')) ? e.getCoalescedEvents() : [e];
  for (const ev of (evs.length ? evs : [e])) { const [a, b] = toPix(ev.clientX, ev.clientY); moveStroke(a, b); }
});
cv.addEventListener('pointerleave', () => { if (hover) { hover = null; render(); } });
function endPtr(e) {
  if (e.pointerType === 'pen') PEN_DOWN = false;
  if (CG && e.pointerId === CG.id) { endPick(e.type === 'pointerup'); TOUCHES.delete(e.pointerId); return; }
  if (LP && LP.id === e.pointerId) { clearTimeout(LP.t); LP = null; }
  const wasTouch = TOUCHES.delete(e.pointerId);
  if (wasTouch && TOUCHES.size === 0 && GEST) { const g = GEST; GEST = null; pinch = null; gestStop(g);
    if (!g.moved && !g.held && performance.now() - g.t0 < 450 && e.type === 'pointerup') { if (g.max === 2) gestUndo(); else if (g.max >= 3) gestRedo(); }
    if (!g.moved && g.view) { st.zoom = g.view.zoom; st.ox = g.view.ox; st.oy = g.view.oy; render(); } // foi toque, não pinça: a vista volta exatamente ao que era
    stroke = null; return; }
  if (wasTouch && pinch && TOUCHES.size < 2) { pinch = null; stroke = null; return; }
  if (fillPend && fillPend.id === e.pointerId) { const f = fillPend; fillPend = null; if (e.type === 'pointerup' && !GEST && !pinch) beginStroke(f.x, f.y); return; }
  if (stroke && (stroke.id == null || stroke.id === e.pointerId)) { if (stroke.pan) stroke = null; else if (e.type === 'pointercancel') abortStroke(); else endStroke(); }
}
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('contextmenu', (e) => e.preventDefault());
area.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect();
  if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey) { const step = Math.max(1, Math.round(st.zoom * .15)); zoomAt(st.zoom + (e.deltaY < 0 ? step : -step), e.clientX - r.left, e.clientY - r.top); }
  else { st.ox -= e.shiftKey ? e.deltaY : e.deltaX; render(); } }, { passive: false });

