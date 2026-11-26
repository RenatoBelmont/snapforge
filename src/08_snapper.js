/* ======================================================================
   LUPA das imagens (como no Pixel Snapper do Sprite Fusion), sincronizada entre os painéis do grupo
   ====================================================================== */
function setupLoupe(group, segEl) {
  const MAGS = [0, 2, 4, 8, 16]; let mag = LS.get('loupe.' + group, 4);
  const drawSeg = () => { segEl.innerHTML = MAGS.map(m => `<button data-m="${m}" class="${m === mag ? 'on' : ''}">${m ? m + '×' : 'Off'}</button>`).join(''); };
  segEl.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (!b) return; mag = +b.dataset.m; LS.set('loupe.' + group, mag); drawSeg(); hideAll(); });
  drawSeg();
  const panes = () => $$(`.pane[data-lg="${group}"]`);
  const hideAll = () => panes().forEach(p => { const l = p.querySelector('.loupe'); if (l) l.style.display = 'none'; });
  const geom = (pane) => { const c = pane.querySelector('canvas.img'); if (!c || !c.width) return null; const r = c.getBoundingClientRect(), s = Math.min(r.width / c.width, r.height / c.height); return { c, r, s, dw: c.width * s, dh: c.height * s, ox: (r.width - c.width * s) / 2, oy: (r.height - c.height * s) / 2 }; };
  function show(src, clientX, clientY) {
    if (!mag) return hideAll(); const g0 = geom(src); if (!g0) return hideAll();
    const u = (clientX - g0.r.left - g0.ox) / g0.dw, v = (clientY - g0.r.top - g0.oy) / g0.dh; if (u < 0 || v < 0 || u > 1 || v > 1) return hideAll();
    for (const p of panes()) {
      const g = geom(p), L = p.querySelector('.loupe'); if (!L) continue; if (!g) { L.style.display = 'none'; continue; }
      const pr = p.getBoundingClientRect(), cxp = g.r.left - pr.left + g.ox + u * g.dw, cyp = g.r.top - pr.top + g.oy + v * g.dh;
      L.style.display = 'block'; L.style.left = (cxp - 85) + 'px'; L.style.top = (cyp - 85) + 'px';
      const lc = L.querySelector('canvas'), x = lc.getContext('2d'), S = lc.width, srcSize = 170 / (g.s * mag), sx = u * g.c.width - srcSize / 2, sy = v * g.c.height - srcSize / 2;
      x.imageSmoothingEnabled = false; x.fillStyle = '#2a2a2f'; x.fillRect(0, 0, S, S); const cs = S / 12; x.fillStyle = '#1f1f23'; for (let yy = 0; yy < 12; yy++) for (let xx = yy % 2; xx < 12; xx += 2) x.fillRect(xx * cs, yy * cs, cs, cs);
      x.drawImage(g.c, sx, sy, srcSize, srcSize, 0, 0, S, S);
      const px = S / srcSize, cx0 = (Math.floor(u * g.c.width) - sx) * px, cy0 = (Math.floor(v * g.c.height) - sy) * px;
      if (px >= 6) { x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 2; x.strokeRect(cx0, cy0, px, px); }
    }
  }
  for (const p of panes()) {
    p.addEventListener('pointerdown', (e) => { try { p.setPointerCapture(e.pointerId); } catch {} show(p, e.clientX, e.clientY); });
    p.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) show(p, e.clientX, e.clientY); });
    p.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') hideAll(); });
    p.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hideAll(); });
    p.addEventListener('pointercancel', hideAll);
    p.addEventListener('wheel', (e) => { if (!mag) return; e.preventDefault(); const i = MAGS.indexOf(mag); mag = MAGS[clamp(i + (e.deltaY < 0 ? 1 : -1), 1, MAGS.length - 1)]; LS.set('loupe.' + group, mag); drawSeg(); show(p, e.clientX, e.clientY); }, { passive: false });
  }
}

/* ======================================================================
   PIXEL SNAPPER
   ====================================================================== */
let snapIn = null, snapOut = null, sFitN = LS.get('s.fit', 0);
const sPal = palettePicker($('#sPalPick'), { value: '', auto: true, doc: true, onChange: () => {} });
function renderFitChips() { $('#sFit').innerHTML = `<button data-n="0" class="${!sFitN ? 'on' : ''}" style="font-family:var(--font)">Não forçar</button>` + SIZES.map(s => `<button data-n="${s}" class="${sFitN === s ? 'on' : ''}">${s}</button>`).join(''); }
$('#sFit').addEventListener('click', (e) => { const b = e.target.closest('[data-n]'); if (!b) return; sFitN = +b.dataset.n; LS.set('s.fit', sFitN); renderFitChips(); });
renderFitChips();
$('#sK').oninput = (e) => { $('#sKv').textContent = e.target.value; };
$('#sPxMode').onchange = (e) => { $('#sPx').disabled = e.target.value !== 'manual'; };
function setSnapInput(img) {
  snapIn = img; drawToPane($('#sIn'), img); $('#sInE').style.display = 'none'; $('#sInT').textContent = `original · ${img.width}×${img.height}`;
  $('#sGo').disabled = false; snapOut = null; $('#sOut').width = 0; $('#sOutE').style.display = ''; $('#sOutE').textContent = 'toque em ' + $('#sGo').textContent.trim(); // segue o nome do botão em cada interface $('#sStats').innerHTML = '';
  ['sToEd', 'sToLayer', 'sToTile', 'sDl', 'sToN'].forEach(id => $('#' + id).disabled = true);
  let m = 0; for (let i = 0; i < img.data.length; i += 16) if (img.data[i] > 220 && img.data[i + 1] < 60 && img.data[i + 2] > 220) m++; $('#sKey').checked = m > img.data.length / 16 * 0.05;
}
bindDrop($('#sDrop'), async (f) => { try { setSnapInput(await withBusy('Abrindo imagem…', () => fileToImage(f))); } catch (e) { toast(e.message); } });
$('#sFromEd').onclick = () => setSnapInput(composite(cur.frame));
$('#sGo').onclick = async () => {
  if (!snapIn) return; const opts = { k_colors: +$('#sK').value };
  if ($('#sPxMode').value === 'manual') opts.pixel_size_override = parseFloat(String($('#sPx').value).replace(',', '.'));
  const pv = sPal.get(), keyM = $('#sKey').checked;
  if (pv) { const list = (pv === '__doc' ? palList(palName) : palList(pv)).map(h => h.slice(1)); if (keyM && !list.includes('ff00ff')) list.push('ff00ff'); opts.palette = list.join(','); }
  const t0 = performance.now();
  try {
    let out = await withBusy('Encaixando na grade…', () => runEngine('snap', snapIn, opts), `${snapIn.width}×${snapIn.height} px · detectando o tamanho do pixel`); const ps = out.pixelSize;
    if (keyM) out = keyMagenta(out, pv ? 4 : 90); const det = { w: out.width, h: out.height }; if (sFitN) out = fitImage(out, sFitN, sFitN);
    snapOut = out; drawToPane($('#sOut'), out); $('#sOutE').style.display = 'none'; $('#sOutT').textContent = `encaixada · ${out.width}×${out.height}`;
    const colors = new Set(); for (let i = 0; i < out.data.length; i += 4) if (out.data[i + 3]) colors.add((out.data[i] << 16) | (out.data[i + 1] << 8) | out.data[i + 2]);
    $('#sStats').innerHTML = `<span class="kv">Pixel ${opts.pixel_size_override ? '(manual)' : '(detectado)'} <b>${(+ps).toFixed(1)} px</b></span><span class="kv">Grade <b>${det.w}×${det.h}</b></span>${sFitN ? `<span class="kv">Final <b>${sFitN}×${sFitN}</b></span>` : ''}<span class="kv">Cores <b>${colors.size}</b></span><span class="kv">Tempo <b>${Math.round(performance.now() - t0)} ms</b></span>`;
    ['sToEd', 'sToLayer', 'sToTile', 'sDl', 'sToN'].forEach(id => $('#' + id).disabled = false);
  } catch (e) { toast('Erro: ' + e.message, 4000); }
};
$('#sToEd').onclick = () => snapOut && openImageAsDoc(snapOut, 'Snapper');
$('#sToLayer').onclick = () => snapOut && addImageAsLayer(snapOut, 'Snapper');
$('#sToTile').onclick = () => { if (snapOut) { setTileset(snapOut, 'Snapper'); showView('tile'); } };
$('#sDl').onclick = async () => { if (!snapOut) return; const s = await askScale('Baixar PNG', `${snapOut.width}×${snapOut.height}`); if (s) saveBlob(await canvasBlob(scaled(snapOut, s)), `snapped_${snapOut.width}x${snapOut.height}${s > 1 ? '_' + s + 'x' : ''}.png`); };
$('#sToN').onclick = () => { if (snapOut) { setNormalInput(snapOut, null); showView('normal'); } };
setupLoupe('s', $('#sLoupe'));

/* ---------- prompt para o ChatGPT (sem API: só monta o texto para colar) ---------- */
const P = Object.assign({ subj: '', size: 32, pal: DEFAULT_PAL, view: 'frontal', outline: 'dark', fill: '80', extra: '' }, LS.get('prompt', {}));
function buildPrompt() {
  const n = P.size, blk = 1024 / n, b = Number.isInteger(blk) ? blk : blk.toFixed(2), pal = palList(P.pal), subj = P.subj.trim() || '[describe the object]';
  const darkest = pal.slice().sort((a, c) => { const l = (h) => { const [r, g, bb] = hex2rgb(h); return .299 * r + .587 * g + .114 * bb; }; return l(a) - l(c); })[0];
  const L = ['Pixel art sprite: ' + subj + '.', '', 'GRID AND SIZE', `- Logical sprite of exactly ${n}x${n} pixels.`, `- Render the image at 1024x1024. Each logical pixel is one perfectly square block of ${b}x${b} real pixels, on a perfectly regular grid.`, '- Every block is a single flat color. No half pixels, no sub-pixel detail.', '',
    'STYLE', '- No anti-aliasing, no gradients, no blur, no texture, no noise, no glow.', '- No dithering unless the palette requires it.',
    P.outline === 'dark' ? `- 1 logical pixel outline in ${darkest} around the silhouette.` : P.outline === 'sel' ? '- 1 logical pixel colored outline (darker shade of the adjacent fill color).' : '- No outline; shapes defined by color only.',
    '- Light comes from the top-left; shadows use one darker shade of the same hue.', `- Use at most ${Math.min(pal.length, 16)} colors in total.`, '',
    'PALETTE (use ONLY these exact colors)', pal.join(' '), '', 'FRAMING', '- Solid flat background #FF00FF (pure magenta) filling the whole canvas. Never use magenta in the sprite.',
    `- Single object, centered, occupying at most ${P.fill}% of the canvas, with at least 2 logical pixels of empty margin on every side.`, `- View: ${P.view}.`, '- No scenery, no text, no frame, no watermark, no ground shadow.'];
  if (P.extra.trim()) L.push('', 'EXTRA', '- ' + P.extra.trim());
  return L.join('\n');
}
$('#sPrompt').onclick = () => {
  const views = ['frontal', '3/4 vista de cima (estilo RPG)', 'lateral (estilo plataforma)', 'isométrica', 'de cima (top-down)'];
  modal('Prompt para o ChatGPT', `<p class="hint">Gera o texto com as regras de grade, paleta e enquadramento. Cole no ChatGPT, baixe a imagem e abra aqui no Snapper com o mesmo tamanho em "Tamanho final".</p>
    <label class="lbl">Descrição<textarea class="input-field" id="pSubj" placeholder="ex.: poção de cura vermelha em frasco redondo">${esc(P.subj)}</textarea></label>
    <div class="lbl">Tamanho<div class="chips" id="pSize">${SIZES.map(s => `<button data-n="${s}" class="${P.size === s ? 'on' : ''}">${s}</button>`).join('')}</div></div>
    <div class="lbl">Paleta<div id="pPal"></div></div>
    <div class="grid2"><label class="lbl">Vista<select class="input-field" id="pView">${views.map(v => `<option${v === P.view ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="lbl">Contorno<select class="input-field" id="pOut"><option value="dark">1 px escuro</option><option value="sel">1 px colorido</option><option value="none">sem contorno</option></select></label></div>
    <div class="grid2"><label class="lbl">Ocupação<select class="input-field" id="pFill"><option value="80">80%</option><option value="95">95% (tile)</option><option value="60">60% (ícone)</option></select></label>
      <label class="lbl">Regras extras<input class="input-field" id="pExtra" value="${esc(P.extra)}" placeholder="ex.: sem dithering"></label></div>
    <div id="pWarn"></div><pre class="prompt" id="pPre"></pre><button class="btn pri" id="pCopy">${ico('copy')}Copiar prompt</button>`, [['Fechar', null]]);
  const box = $('#mBox'); $('#pOut', box).value = P.outline; $('#pFill', box).value = P.fill;
  const upd = () => { LS.set('prompt', P); $('#pPre', box).textContent = buildPrompt(); $('#pWarn', box).innerHTML = 1024 % P.size ? `<div class="note">${P.size} não divide 1024, então a grade fica irregular. O Snapper corrige, mas 16, 32, 64 e 128 saem mais limpos.</div>` : ''; };
  palettePicker($('#pPal', box), { value: P.pal, onChange: (v) => { P.pal = v; upd(); } });
  $('#pSubj', box).oninput = (e) => { P.subj = e.target.value; upd(); }; $('#pExtra', box).oninput = (e) => { P.extra = e.target.value; upd(); };
  $('#pView', box).onchange = (e) => { P.view = e.target.value; upd(); }; $('#pOut', box).onchange = (e) => { P.outline = e.target.value; upd(); }; $('#pFill', box).onchange = (e) => { P.fill = e.target.value; upd(); };
  $('#pSize', box).onclick = (e) => { const b = e.target.closest('[data-n]'); if (!b) return; P.size = +b.dataset.n; $$('#pSize button', box).forEach(x => x.classList.toggle('on', x === b)); sFitN = P.size; LS.set('s.fit', sFitN); renderFitChips(); upd(); };
  $('#pCopy', box).onclick = async () => { try { await navigator.clipboard.writeText(buildPrompt()); toast('Prompt copiado — cole no ChatGPT'); } catch { const r = document.createRange(); r.selectNodeContents($('#pPre', box)); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Selecionei o texto: copie pelo menu'); } };
  upd();
};
