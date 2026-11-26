/* ======================================================================
   EDITOR — trilho de ferramentas (v1), barra do palco e painel direito em cards (v1)
   ====================================================================== */
const TOOLS = [['pencil', 'pencil', 'Lápis', 'B'], ['eraser', 'eraser', 'Borracha', 'E'], ['fill', 'bucket', 'Balde', 'G'], ['pick', 'pipette', 'Conta-gotas (ou segure o dedo)', 'I'], '|',
  ['line', 'line', 'Linha', 'L'], ['rect', 'rect', 'Retângulo', 'U'], ['ellipse', 'ellipse', 'Elipse', 'O'], '|', ['select', 'select', 'Seleção', 'S'], ['move', 'move', 'Mover', 'M'], ['hand', 'hand', 'Mão (navegar)', 'H']];
const ACTIONS = [['flipH', 'flipH', 'Espelhar (camada ou seleção) na horizontal'], ['flipV', 'flipV', 'Espelhar na vertical'], ['rotate', 'rotate', 'Girar 90°'], ['outline', 'outline', 'Contorno automático com a cor atual'], ['clear', 'trash', 'Limpar camada ou seleção (Delete)']];
function buildRail() {
  $('#rail').innerHTML = TOOLS.map(t => t === '|' ? '<hr>' : `<button class="tool" data-tool="${t[0]}" title="${t[2]} (${t[3]})">${ico(t[1])}<span class="k">${t[3]}</span></button>`).join('') + '<hr>' +
    ACTIONS.map(a => `<button class="tool" data-ra="${a[0]}" title="${a[2]}">${ico(a[1])}</button>`).join('');
}
$('#rail').addEventListener('click', (e) => {
  const t = e.target.closest('[data-tool]'); if (t) { setTool(t.dataset.tool); return; }
  const a = e.target.closest('[data-ra]'); if (!a) return; const k = a.dataset.ra;
  if (k === 'flipH') transformArea('fh'); else if (k === 'flipV') transformArea('fv'); else if (k === 'rotate') transformArea('rot'); else if (k === 'outline') autoOutline(); else if (k === 'clear') clearArea();
});
function setTool(t) { if (['line', 'rect', 'ellipse'].includes(t)) st.shape = t; st.tool = t; $$('#rail [data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); renderBrush(); updateBar(); renderPRow(); render(); }
function updateBar() {
  $('#undoBtn').disabled = !hist.length; $('#redoBtn').disabled = !future.length;
  $('#penBtn').classList.toggle('on', st.penOnly); $('#penTxt').textContent = st.penOnly ? 'Só Pencil' : 'Dedo pinta';
  $('#focoBtn').innerHTML = ico(document.body.classList.contains('foco') ? 'minimize' : 'maximize'); $('#faixaBtn').classList.toggle('on', st.faixa);
  const sb = $('#selBar');
  sb.innerHTML = selRect ? `<span class="mono small muted">${selRect.w}×${selRect.h}</span>` + [['copy', 'copy', 'Copiar (⌘C)'], ['cut', 'scissors', 'Recortar (⌘X)'], ['paste', 'clipboard', 'Colar (⌘V)'], ['crop', 'crop', 'Cortar o canvas na seleção'], ['desel', 'x', 'Tirar seleção (Esc)']].map(b => `<button class="btn sm ic" data-sb="${b[0]}" title="${b[2]}">${ico(b[1])}</button>`).join('') + '<span class="sep"></span>'
    : (clip ? `<button class="btn sm ic" data-sb="paste" title="Colar (⌘V)">${ico('clipboard')}</button><span class="sep"></span>` : '');
}
$('#selBar').addEventListener('click', (e) => { const b = e.target.closest('[data-sb]'); if (!b) return; const k = b.dataset.sb;
  if (k === 'copy') copySel(false); else if (k === 'cut') copySel(true); else if (k === 'paste') pasteClip(); else if (k === 'crop') cropToSel(); else { selRect = null; render(); } updateBar(); });
$('#bar').addEventListener('click', (e) => { const f = e.target.closest('[data-f]'); if (f) fileAct(f.dataset.f); });
$('#docName').onclick = () => fileAct('rename');
$('#penBtn').onclick = () => setPenOnly(!st.penOnly);
$('#undoBtn').onclick = () => undo(); $('#redoBtn').onclick = () => redo();
$('#zoomIn').onclick = () => { const r = area.getBoundingClientRect(); zoomAt(st.zoom + Math.max(1, Math.round(st.zoom * .25)), r.width / 2, r.height / 2); };
$('#zoomOut').onclick = () => { const r = area.getBoundingClientRect(); zoomAt(st.zoom - Math.max(1, Math.round(st.zoom * .2)), r.width / 2, r.height / 2); };
$('#zoomLbl').onclick = () => fit();
$('#focoBtn').onclick = () => toggleFoco();
$('#faixaBtn').onclick = () => { st.faixa = !st.faixa; LS.set('faixa', st.faixa); renderFaixa(); updateBar(); requestAnimationFrame(resizeCanvas); };
function toggleFoco() { document.body.classList.toggle('foco'); renderFaixa(); updateBar(); requestAnimationFrame(() => { resizeCanvas(); fit(); if (typeof tResize === 'function') { tResize(); } }); }
const renderSubtitle = () => { $('#docName').textContent = doc.name; $('#docName').title = `Renomear projeto — ${doc.name}`; };

/* ---------- painel direito em cards (v1), recolhíveis ---------- */
const cardOpen = LS.get('cards', { cor: true, pincel: true, camadas: true, animacao: false, canvas: false });
const cardShell = (id, title, acts = '') => `<div class="card${cardOpen[id] === false ? ' closed' : ''}" data-card="${id}" style="--dc:var(--c-editor)"><div class="card-h" data-toggle="${id}"><span class="dot"></span>${title}${acts ? `<span class="acts">${acts}</span>` : '<span class="spacer"></span>'}${ico('chevron')}</div><div class="card-b" id="cb-${id}"></div></div>`;
const tbx2 = (k, icon, title, cls = '') => `<button class="btn sm ic ${cls}" data-pc="${k}" title="${esc(title)}" aria-label="${esc(title)}">${ico(icon)}</button>`;
function buildSide() {
  // Canvas em 2º (pedido do Renato), fechado por padrão
  $('#side').innerHTML = cardShell('cor', 'Cor') + cardShell('canvas', 'Canvas') + cardShell('pincel', 'Pincel e vista') +
    cardShell('camadas', 'Camadas', tbx2('layAdd', 'plus', 'Nova camada') + tbx2('layDup', 'copy', 'Duplicar camada (⌘D)') + tbx2('layMerge', 'merge', 'Mesclar com a de baixo') + tbx2('layDel', 'trash', 'Excluir camada', 'danger')) +
    cardShell('animacao', 'Animação', tbx2('frAdd', 'plus', 'Novo quadro') + tbx2('frDup', 'copy', 'Duplicar quadro') + tbx2('frDel', 'trash', 'Excluir quadro', 'danger'));
  // só a seta do cabeçalho gira ao fechar; antes "svg:last-child" pegava também o ícone de cada botão de ação e eles "deitavam"
  $$('#side .card-h > svg:last-child').forEach(s => s.classList.add('cv'));
  renderColor(); renderBrush(); renderLayers(); renderFrames(); renderCanvasCard();
}
$('#side').addEventListener('click', (e) => {
  if (e.target.closest('.acts')) return; const t = e.target.closest('[data-toggle]'); if (!t) return;
  const id = t.dataset.toggle, card = t.parentElement; card.classList.toggle('closed'); cardOpen[id] = !card.classList.contains('closed'); LS.set('cards', cardOpen);
});
let palPick = null;
function renderColor() {
  const b = $('#cb-cor'); if (!b) return; const c = st.color, hex = rgb2hex(c[0], c[1], c[2]), pal = palList(palName);
  st.swatch = pal.indexOf(hex);
  b.innerHTML = `<div class="colors"><button class="cur checker" id="curColor" title="Abrir seletor de cor"><i style="background:rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})"></i></button>
      <div class="stack" style="gap:4px;flex:1"><input class="input-field mono" id="hexIn" maxlength="7" value="${hex}" aria-label="Cor em hex"><div class="row"><span class="small muted" style="width:44px">Opac.</span><input type="range" id="alphaIn" min="0" max="255" value="${c[3]}"></div></div></div>
    <div class="row"><div id="palPickHost" style="flex:1;min-width:0"></div>${tbx2('palAdd', 'plus', 'Adicionar a cor atual à paleta')}${tbx2('palDel', 'trash', 'Remover a cor selecionada da paleta', 'danger')}</div>
    <div class="swatches">${pal.map((h, i) => `<button class="sw${i === st.swatch ? ' on' : ''}" style="background:${h}" data-sw="${i}" title="${h}"></button>`).join('')}</div>
    ${recent.length ? `<div class="row" style="gap:6px"><span class="small muted">Recentes</span><div class="recent">${recent.slice(0, 9).map(r => `<button style="background:${r}" data-rc="${r}" title="${r}"></button>`).join('')}</div></div>` : ''}
    <div class="row wrap"><button class="btn sm" data-pc="palFromImg">Extrair do desenho</button><button class="btn sm" data-pc="palHex">Colar hex</button><button class="btn sm" data-pc="palLospec" title="Importar uma paleta do Lospec pelo link ou pelo nome (precisa de internet)">${ico('import')}Do Lospec</button><button class="btn sm" data-pc="palFile" title="Abrir arquivo de paleta .hex, .gpl ou .pal (funciona sem internet)">${ico('folder')}Arquivo</button></div>`;
  palPick = palettePicker($('#palPickHost'), { value: palName, onChange: (v) => { palName = v; LS.set('palName', palName); st.swatch = -1; renderColor(); renderFaixa(); } });
  $('#hexIn').addEventListener('input', (e) => { let v = e.target.value.trim(); if (v[0] !== '#') v = '#' + v; if (/^#[0-9a-f]{6}$/i.test(v)) setColor([...hex2rgb(v), st.color[3]], true); });
  $('#hexIn').addEventListener('change', () => { pushRecent(rgb2hex(...st.color.slice(0, 3))); renderColor(); });
  $('#alphaIn').addEventListener('input', (e) => setColor([st.color[0], st.color[1], st.color[2], +e.target.value], true));
  $('#curColor').onclick = () => openColorPicker($('#curColor'));
}
function setColor(c, live) {
  st.color = c.slice(); if (st.tool === 'eraser' && !live) setTool('pencil');
  if (live) { const i = $('#curColor i'); if (i) i.style.background = `rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})`; const h = $('#hexIn'); if (h && document.activeElement !== h) h.value = rgb2hex(c[0], c[1], c[2]); const sw = palList(palName).indexOf(rgb2hex(c[0], c[1], c[2])); $$('#cb-cor .sw').forEach((s, i) => s.classList.toggle('on', i === sw)); }
  else { pushRecent(rgb2hex(c[0], c[1], c[2])); renderColor(); }
  renderFaixa();
}
function setBrush(n) { st.brush = clamp(n | 0, 1, 16); LS.set('brush', st.brush); renderBrush(); render(); }
function renderBrush() {
  const b = $('#cb-pincel'); if (!b) return; const t = st.tool;
  const ck = (id, on, label, title = '') => `<label class="chk" title="${esc(title)}"><input type="checkbox" data-ck="${id}"${on ? ' checked' : ''}> ${label}</label>`;
  b.innerHTML = `<div class="lbl"><span>Tamanho do pincel: ${st.brush} px <span class="muted" style="font-weight:500">(teclas [ e ])</span></span><div class="chips" id="brushSeg">${BRUSHES.map(n => `<button data-b="${n}" class="${n === st.brush ? 'on' : ''}" aria-label="Pincel de ${n} px">${n}</button>`).join('')}</div></div>
    <div class="row"><span class="small muted" style="width:62px">Formato</span><div class="seg" id="brushShape"><button data-bs="round" class="${st.brushShape !== 'square' ? 'on' : ''}">Redondo</button><button data-bs="square" class="${st.brushShape === 'square' ? 'on' : ''}">Quadrado</button></div></div>
    ${ck('pixelPerfect', st.pixelPerfect, 'Pixel perfeito no lápis', 'Tira os cantos em L dos traços de 1 px')}
    ${ck('fillShape', st.fillShape, 'Formas preenchidas')}
    ${ck('contiguous', st.contiguous, 'Balde só na área conectada', 'Desligado: troca a cor no desenho inteiro')}
    <div class="grid2">${ck('mirrorX', st.mirrorX, 'Espelhar ↔')}${ck('mirrorY', st.mirrorY, 'Espelhar ↕')}</div>
    <div class="grid2">${ck('grid', st.grid, 'Grade')}${ck('onion', st.onion, 'Papel de seda', 'Mostra o quadro anterior por baixo')}</div>
    ${ck('penOnly', st.penOnly, 'Só a Apple Pencil pinta', 'O dedo e a palma só movem e dão zoom')}`;
}
$('#side').addEventListener('change', (e) => { const c = e.target.closest('[data-ck]'); if (!c) return; const k = c.dataset.ck;
  if (k === 'penOnly') setPenOnly(c.checked); else { st[k] = c.checked; render(); } });
$('#side').addEventListener('click', async (e) => {
  const bb = e.target.closest('[data-b]'); if (bb) { setBrush(+bb.dataset.b); return; }
  const bs = e.target.closest('[data-bs]'); if (bs) { st.brushShape = bs.dataset.bs; LS.set('brushShape', st.brushShape); renderBrush(); render(); return; }
  const rc = e.target.closest('[data-rc]'); if (rc) { setColor([...hex2rgb(rc.dataset.rc), 255]); return; }
  const sw = e.target.closest('[data-sw]'); if (sw) { setColor([...hex2rgb(palList(palName)[+sw.dataset.sw]), 255]); return; }
  const vis = e.target.closest('[data-vis]'); if (vis) { pushHist(); const L = doc.layers[+vis.dataset.vis]; L.visible = !L.visible; refreshAfterEdit(); return; }
  const lk = e.target.closest('[data-lock]'); if (lk) { const L = doc.layers[+lk.dataset.lock]; L.locked = !L.locked; markDirty(); renderLayers(); return; }
  const row = e.target.closest('[data-li]'); if (row && !e.target.closest('[data-grip]')) { const i = +row.dataset.li, now = performance.now();
    if (lastTap.i === i && now - lastTap.t < 380 && e.target.closest('[data-nm]')) { lastTap = { t: 0, i: -1 }; renameLayer(i); return; }
    lastTap = { t: now, i }; cur.layer = i; renderLayers(); render(); return; }
  const fr = e.target.closest('[data-fr]'); if (fr) { cur.frame = +fr.dataset.fr; fullRefresh(); return; }
  const sz = e.target.closest('[data-size]'); if (sz) { const n = +sz.dataset.size; if (n === doc.w && n === doc.h) return; pushHist(); applyResize(n, n, st.resizeMode || 'anchor'); fit(); fullRefresh(); toast(`Canvas ${n}×${n} (⌘Z desfaz)`); return; }
  const rm = e.target.closest('[data-rm]'); if (rm) { st.resizeMode = rm.dataset.rm; renderCanvasCard(); return; }
  const b = e.target.closest('[data-pc]'); if (!b) return; const k = b.dataset.pc;
  if (k === 'palAdd') { const l = palList(palName), h = rgb2hex(...st.color.slice(0, 3)); if (l.includes(h)) return toast('Essa cor já está na paleta'); if (l.length >= 256) return toast('Máximo de 256 cores'); l.push(h); savePal(palName, l); }
  else if (k === 'palDel') { const l = palList(palName), i = l.indexOf(rgb2hex(...st.color.slice(0, 3))); if (i < 0) return toast('Escolha uma cor da paleta primeiro'); if (l.length <= 1) return; l.splice(i, 1); savePal(palName, l); }
  else if (k === 'palFromImg') { const s = new Set(); for (let f = 0; f < doc.frames.length; f++) { const c = composite(f); for (let i = 0; i < c.data.length; i += 4) if (c.data[i + 3] > 0) s.add(rgb2hex(c.data[i], c.data[i + 1], c.data[i + 2])); if (s.size > 256) break; }
    if (!s.size) return toast('O desenho está vazio'); if (s.size > 256) return toast('Mais de 256 cores — use o Pixel Snapper para reduzir'); savePal('Do desenho', [...s]); toast(s.size + ' cores extraídas'); }
  else if (k === 'palLospec') {
    const f = await modal('Importar do Lospec', `<label class="lbl">Link ou nome da paleta<input class="input-field" id="lsIn" placeholder="lospec.com/palette-list/resurrect-64" autocomplete="off" autocapitalize="off" spellcheck="false"></label><p class="hint">Copie o endereço da página da paleta no Lospec, ou digite o nome dela (ex.: Resurrect 64). A paleta fica salva no aparelho e depois funciona sem internet.</p>`, [['Cancelar', null], ['Importar', '__form', 'primary']]);
    if (!f) return; const q = $('#lsIn', f).value;
    try { const p = await withBusy('Buscando no Lospec…', () => fetchLospecPalette(q), lospecSlug(q)); const r = adoptPalette(p.name, p.colors);
      toast(r.builtin ? `${r.name} já está nas paletas padrão: selecionada` : `${r.name}${p.author ? ' (' + p.author + ')' : ''}: ${p.colors.length} cores salvas`, 3200); }
    catch (er) { toast(er.message || 'Não deu para importar', 4200); } }
  else if (k === 'palFile') {
    const file = await pickFile(''); if (!file) return; // sem filtro: o Safari do iPad deixa cinza extensões que não conhece (.gpl/.pal); o leitor recusa o que não for paleta
    try { const p = parsePaletteFile(new Uint8Array(await file.arrayBuffer()), file.name), r = adoptPalette(p.name, p.colors); toast(r.builtin ? `${r.name} já está nas paletas padrão: selecionada` : `${r.name}: ${p.colors.length} cores salvas`, 3000); }
    catch (er) { toast(er.message || 'Arquivo de paleta inválido', 4000); } }
  else if (k === 'palHex') { const f = await modal('Colar paleta', `<label class="lbl">Nome<input class="input-field" id="phN" value="Minha paleta"></label><label class="lbl">Cores em hex (vírgula, espaço ou uma por linha — dá para colar do Lospec)<textarea class="input-field" id="phT" placeholder="1a1c2c, 5d275d, b13e53"></textarea></label>`, [['Cancelar', null], ['Salvar', '__form', 'primary']]);
    if (!f) return; const list = ($('#phT', f).value.match(/[0-9a-f]{6}/gi) || []).map(h => '#' + h.toLowerCase()); if (!list.length) return toast('Nenhuma cor hex encontrada'); savePal($('#phN', f).value.trim() || 'Minha paleta', [...new Set(list)].slice(0, 256)); toast(list.length + ' cores salvas'); }
  else if (k === 'layAdd') addLayer(); else if (k === 'layDup') dupLayer();
  else if (k === 'layDel') { if (doc.layers.length <= 1) return toast('Precisa ter ao menos uma camada'); pushHist(); doc.layers.splice(cur.layer, 1); doc.frames.forEach(fr => fr.splice(cur.layer, 1)); cur.layer = Math.max(0, cur.layer - 1); fullRefresh(); }
  else if (k === 'layMerge') { if (cur.layer === 0) return toast('Não há camada abaixo'); if (doc.layers[cur.layer].locked || doc.layers[cur.layer - 1].locked) return toast('Destrave as duas camadas para mesclar'); pushHist(); const i = cur.layer, L = doc.layers[i];
    doc.frames.forEach(fr => { const top = fr[i], bot = fr[i - 1]; for (let o = 0; o < top.length; o += 4) { const sa = top[o + 3] / 255 * L.opacity; if (sa <= 0) continue; const da = bot[o + 3] / 255, oa = sa + da * (1 - sa); for (let c = 0; c < 3; c++) bot[o + c] = (top[o + c] * sa + bot[o + c] * da * (1 - sa)) / oa; bot[o + 3] = oa * 255; } fr.splice(i, 1); });
    doc.layers.splice(i, 1); cur.layer = i - 1; fullRefresh(); }
  else if (k === 'layUp') moveLayer(cur.layer, cur.layer + 1); else if (k === 'layDown') moveLayer(cur.layer, cur.layer - 1);
  else if (k === 'layTop') moveLayer(cur.layer, doc.layers.length - 1); else if (k === 'layBottom') moveLayer(cur.layer, 0);
  else if (k === 'frAdd') { pushHist(); doc.frames.splice(cur.frame + 1, 0, doc.layers.map(() => newLayerData())); cur.frame++; fullRefresh(); }
  else if (k === 'frDup') { pushHist(); doc.frames.splice(cur.frame + 1, 0, doc.frames[cur.frame].map(a => new Uint8ClampedArray(a))); cur.frame++; fullRefresh(); }
  else if (k === 'frDel') { if (doc.frames.length <= 1) return toast('Precisa ter ao menos um quadro'); pushHist(); doc.frames.splice(cur.frame, 1); cur.frame = Math.max(0, cur.frame - 1); fullRefresh(); }
  else if (k === 'frLeft' || k === 'frRight') { const j = cur.frame + (k === 'frLeft' ? -1 : 1); if (j < 0 || j >= doc.frames.length) return; pushHist(); [doc.frames[cur.frame], doc.frames[j]] = [doc.frames[j], doc.frames[cur.frame]]; cur.frame = j; fullRefresh(); }
  else if (k === 'play') { playing ? stopPlay() : startPlay(); renderFrames(); }
  else if (k === 'sheet') fileAct('sheet');
  else if (k === 'resize') { const W = clamp(parseInt($('#cvW').value) || doc.w, 1, 512), H = clamp(parseInt($('#cvH').value) || doc.h, 1, 512); if (W === doc.w && H === doc.h) return; pushHist(); applyResize(W, H, st.resizeMode || 'anchor'); fit(); fullRefresh(); }
});
let lastTap = { t: 0, i: -1 };
function layerRow(i) { const L = doc.layers[i]; return `<div class="layer${i === cur.layer ? ' sel' : ''}" data-li="${i}"><span class="grip" data-grip="${i}" title="Arraste para reordenar">${ico('gripv')}</span><canvas class="px checker" data-i="${i}"></canvas><span class="nm" data-nm="${i}">${esc(L.name)}</span>
  <button class="li${L.visible ? '' : ' off'}" data-vis="${i}" title="${L.visible ? 'Ocultar' : 'Mostrar'}">${ico(L.visible ? 'eye' : 'eyeoff')}</button><button class="li${L.locked ? ' lk' : ''}" data-lock="${i}" title="${L.locked ? 'Destravar' : 'Travar (impede editar sem querer)'}">${ico(L.locked ? 'lock' : 'unlock')}</button></div>`; }
function thumb(c, img) { c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0); }
function renderLayers() {
  const b = $('#cb-camadas'); if (!b) return; const L = doc.layers[cur.layer];
  b.innerHTML = `<div class="layers" id="layerList">${doc.layers.map((_, i) => i).reverse().map(layerRow).join('')}</div>
    <div class="row"><span class="small muted" style="width:44px">Opac.</span><input type="range" min="0" max="100" value="${Math.round(L.opacity * 100)}" id="layOp"><b class="mono small" id="layOpV" style="width:36px;text-align:right">${Math.round(L.opacity * 100)}%</b></div>
    <div class="row" style="gap:3px"><span class="small muted" style="width:44px">Ordem</span>${tbx2('layTop', 'top', 'Trazer para a frente')}${tbx2('layUp', 'up', 'Subir uma')}${tbx2('layDown', 'down', 'Descer uma')}${tbx2('layBottom', 'bottom', 'Mandar para trás')}</div>`;
  $$('#layerList canvas').forEach(c => thumb(c, { width: doc.w, height: doc.h, data: doc.frames[cur.frame][+c.dataset.i] }));
  const op = $('#layOp'); op.addEventListener('pointerdown', () => pushHist()); op.addEventListener('input', () => { doc.layers[cur.layer].opacity = op.value / 100; $('#layOpV').textContent = op.value + '%'; render(); markDirty(); });
  bindLayerDrag();
}
function renderFrames() {
  const b = $('#cb-animacao'); if (!b) return;
  b.innerHTML = `<div class="frames" id="frameList">${doc.frames.map((_, i) => `<div class="fr${i === cur.frame ? ' sel' : ''}" data-fr="${i}"><canvas class="px checker" data-fi="${i}"></canvas>${i + 1}</div>`).join('')}</div>
    <div class="row" style="gap:3px">${tbx2('frLeft', 'left', 'Mover quadro para a esquerda')}${tbx2('frRight', 'right', 'Mover quadro para a direita')}<span class="spacer"></span><span class="small muted">, e . trocam de quadro</span></div>
    <div class="row"><canvas class="anim px checker" id="animCv"></canvas><div class="stack" style="flex:1;gap:6px">
      <button class="btn sm" data-pc="play">${ico(playing ? 'pause' : 'play')}${playing ? 'Parar' : 'Reproduzir'}</button>
      <label class="lbl">FPS<input class="input-field" id="fpsIn" inputmode="numeric" value="${doc.fps}"></label></div></div>
    <button class="btn sm" data-pc="sheet">${ico('download')}Exportar sprite sheet</button>`;
  $$('#frameList canvas').forEach(c => thumb(c, composite(+c.dataset.fi))); drawAnim(animIdx % doc.frames.length);
  $('#fpsIn').onchange = (e) => { doc.fps = clamp(parseInt(e.target.value) || 8, 1, 60); e.target.value = doc.fps; markDirty(); if (playing) { stopPlay(); startPlay(); } };
}
const SIZES = [16, 24, 32, 48, 64, 80, 96, 112, 128];
function renderCanvasCard() {
  const b = $('#cb-canvas'); if (!b) return; const mode = st.resizeMode || 'anchor';
  b.innerHTML = `<div class="row"><span class="small muted">Atual</span><b class="mono small">${doc.w}×${doc.h}</b></div>
    <div class="chips">${SIZES.map(s => `<button data-size="${s}" class="${doc.w === s && doc.h === s ? 'on' : ''}">${s}</button>`).join('')}</div>
    <div class="lbl">Ao mudar o tamanho<div class="chips"><button data-rm="anchor" class="${mode === 'anchor' ? 'on' : ''}" style="font-family:var(--ui)">Manter desenho</button><button data-rm="scale" class="${mode === 'scale' ? 'on' : ''}" style="font-family:var(--ui)">Redimensionar</button></div></div>
    <div class="grid2"><label class="lbl">Largura<input class="input-field" id="cvW" inputmode="numeric" value="${doc.w}"></label><label class="lbl">Altura<input class="input-field" id="cvH" inputmode="numeric" value="${doc.h}"></label></div>
    <button class="btn sm" data-pc="resize">Aplicar tamanho personalizado</button>
    <label class="lbl">Grade maior a cada<select class="input-field" id="majorSel">${[0, 4, 8, 16, 32].map(n => `<option value="${n}"${n === st.majorGrid ? ' selected' : ''}>${n ? n + ' px' : 'desligada'}</option>`).join('')}</select></label>`;
  $('#majorSel').onchange = (e) => { st.majorGrid = +e.target.value; render(); };
}
function savePal(name, list) { if (PALETTES[name]) { let n = name + ' (minha)', i = 2; while (PALETTES[n]) n = name + ` (minha ${i++})`; name = n; } userPals[name] = list.map(h => h.replace('#', '')).join(','); LS.set('userPals', userPals); palName = name; LS.set('palName', palName); renderColor(); refreshAllPalPickers(); renderFaixa(); }
async function renameLayer(i) { const f = await modal('Renomear camada', `<input class="input-field" id="lnm" value="${esc(doc.layers[i].name)}">`, [['Cancelar', null], ['Salvar', '__form', 'primary']]); if (f) { pushHist(); doc.layers[i].name = $('#lnm', f).value.trim() || doc.layers[i].name; renderLayers(); render(); markDirty(); } }
function addLayer(data, name) { pushHist(); const idx = cur.layer + 1; doc.layers.splice(idx, 0, { name: name || 'Camada ' + (doc.layers.length + 1), visible: true, opacity: 1, locked: false }); doc.frames.forEach((fr, fi) => fr.splice(idx, 0, fi === cur.frame && data ? data : newLayerData())); cur.layer = idx; fullRefresh(); }
function dupLayer() { pushHist(); const idx = cur.layer + 1; doc.layers.splice(idx, 0, { ...doc.layers[cur.layer], name: doc.layers[cur.layer].name + ' cópia', locked: false }); doc.frames.forEach(fr => fr.splice(idx, 0, new Uint8ClampedArray(fr[cur.layer]))); cur.layer = idx; fullRefresh(); }
function moveLayer(from, to) { to = clamp(to, 0, doc.layers.length - 1); if (from === to) return; pushHist(); const [L] = doc.layers.splice(from, 1); doc.layers.splice(to, 0, L); doc.frames.forEach(fr => { const [a] = fr.splice(from, 1); fr.splice(to, 0, a); }); cur.layer = to; fullRefresh(); }
function bindLayerDrag() {
  $$('#layerList [data-grip]').forEach(g => g.addEventListener('pointerdown', (e) => {
    e.preventDefault(); const from = +g.dataset.grip, row = g.closest('.layer'), list = $('#layerList'); g.setPointerCapture(e.pointerId); row.classList.add('drag'); let target = from;
    const mv = (ev) => { row.style.transform = `translateY(${ev.clientY - e.clientY}px)`; for (const r of $$('.layer', list)) { if (r === row) continue; const bb = r.getBoundingClientRect(); if (ev.clientY >= bb.top && ev.clientY <= bb.bottom) target = +r.dataset.li; } };
    const up = () => { g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); row.classList.remove('drag'); row.style.transform = ''; if (target !== from) moveLayer(from, target); };
    g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
  }));
}
let playing = null, animIdx = 0;
function drawAnim(i) { const c = $('#animCv'); if (c) thumb(c, composite(i)); }
function startPlay() { playing = setInterval(() => { animIdx = (animIdx + 1) % doc.frames.length; drawAnim(animIdx); }, 1000 / doc.fps); }
function stopPlay() { clearInterval(playing); playing = null; }
function sheetImage() { const n = doc.frames.length, W = doc.w * n, out = new Uint8ClampedArray(W * doc.h * 4); for (let f = 0; f < n; f++) { const c = composite(f); for (let y = 0; y < doc.h; y++) out.set(c.data.subarray(y * doc.w * 4, (y + 1) * doc.w * 4), (y * W + f * doc.w) * 4); } return { width: W, height: doc.h, data: out }; }
function applyResize(W, H, mode) {
  doc.frames = doc.frames.map(fr => fr.map(a => { if (mode === 'scale') { const out = new Uint8ClampedArray(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = (Math.floor(y * doc.h / H) * doc.w + Math.floor(x * doc.w / W)) * 4; out.set(a.subarray(s, s + 4), (y * W + x) * 4); } return out; } return fitImage({ width: doc.w, height: doc.h, data: a }, W, H).data; }));
  doc.w = W; doc.h = H; selRect = null;
}
function fullRefresh() { cur.frame = clamp(cur.frame, 0, doc.frames.length - 1); cur.layer = clamp(cur.layer, 0, doc.layers.length - 1); render(); updateBar(); renderLayers(); renderFrames(); renderCanvasCard(); renderFaixa(); renderSubtitle(); markDirty(); }

/* ---------- faixa de cores no modo foco (Ponto Cruz) ---------- */
function renderFaixa() {
  renderPRow(); // a fileira de paleta embaixo do canvas acompanha toda troca de cor e de paleta
  const f = $('#faixa'); f.classList.toggle('show', st.faixa); if (!document.body.classList.contains('foco') || !st.faixa) return;
  const pal = palList(palName), h = rgb2hex(...st.color.slice(0, 3));
  f.innerHTML = `<button class="er${st.tool === 'eraser' ? ' on' : ''}" data-fx="er" title="Borracha">${ico('eraser')}</button>` + pal.map(c => `<button style="background:${c}" data-fx="${c}" class="${st.tool !== 'eraser' && c === h ? 'on' : ''}" title="${c}"></button>`).join('');
}
$('#faixa').addEventListener('click', (e) => { const b = e.target.closest('[data-fx]'); if (!b) return; if (b.dataset.fx === 'er') setTool('eraser'); else { setColor([...hex2rgb(b.dataset.fx), 255]); if (!['pencil', 'fill', 'line', 'rect', 'ellipse'].includes(st.tool)) setTool('pencil'); } renderFaixa(); });

/* ---------- status de salvamento ---------- */
let dirtyT = 0;
function setStatus(kind) { const s = $('#status'); s.className = 'status ' + kind; s.lastChild.textContent = { saving: 'Salvando…', saved: 'Salvo localmente', error: 'Não salvo — use Salvar' }[kind]; }
function markDirty() { setStatus('saving'); clearTimeout(dirtyT); dirtyT = setTimeout(() => { dirtyT = 0; setStatus(LS.set('doc', serialize()) ? 'saved' : 'error'); }, 600); }

/* ---------- teclado ---------- */
const KEYMAP = { b: 'pencil', e: 'eraser', g: 'fill', i: 'pick', l: 'line', u: 'rect', o: 'ellipse', s: 'select', m: 'move', h: 'hand' };
const viewOn = (v) => $('#v-' + v).classList.contains('on');
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if ($('#modal').classList.contains('on')) { modal.cancel && modal.cancel(); e.preventDefault(); return; } if (cpEl) { closeColorPicker(); e.preventDefault(); return; } if (ppOpen) { closePP(); e.preventDefault(); return; }
    if (viewOn('editor') && selRect) { selRect = null; render(); updateBar(); e.preventDefault(); return; }
    if (viewOn('tile') && ts.msel) { tDeselect(); e.preventDefault(); return; } if (document.body.classList.contains('foco')) { toggleFoco(); e.preventDefault(); } return; }
  if (e.target.matches('input:not([type=checkbox]):not([type=range]):not([type=color]),textarea,select') || $('#modal').classList.contains('on')) return;
  if (e.target.matches('input')) e.target.blur();
  if (viewOn('tile')) { tileKey(e); return; }
  if (!viewOn('editor')) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  if (mod) { if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); } else if (k === 'y') { e.preventDefault(); redo(); } else if (k === 's') { e.preventDefault(); fileAct('save'); }
    else if (k === 'c') { e.preventDefault(); copySel(false); updateBar(); } else if (k === 'x') { e.preventDefault(); copySel(true); updateBar(); } else if (k === 'v') { e.preventDefault(); pasteClip(); }
    else if (k === 'd') { e.preventDefault(); dupLayer(); } else if (k === 'a') { e.preventDefault(); selRect = { x: 0, y: 0, w: doc.w, h: doc.h }; setTool('select'); } return; }
  if (k === ' ') { panMode = true; e.preventDefault(); return; }
  if (KEYMAP[k]) { setTool(KEYMAP[k]); return; }
  if (k === 'x') { st.mirrorX = !st.mirrorX; renderBrush(); render(); } else if (k === 'f') toggleFoco(); else if (k === 'c' && document.body.classList.contains('foco')) $('#faixaBtn').click();
  else if (k === '0') fit(); else if (k === '+' || k === '=') $('#zoomIn').click(); else if (k === '-') $('#zoomOut').click();
  else if (k === '[' || k === ']') { const i = BRUSHES.indexOf(st.brush), j = i < 0 ? BRUSHES.findIndex(n => n > st.brush) - (k === '[' ? 1 : 0) : i + (k === '[' ? -1 : 1); setBrush(BRUSHES[clamp(j, 0, BRUSHES.length - 1)]); }
  else if (k === 'delete' || k === 'backspace') { e.preventDefault(); clearArea(); }
  else if (k.startsWith('arrow')) { e.preventDefault(); const s = e.shiftKey ? 8 : 1; nudge(k === 'arrowleft' ? -s : k === 'arrowright' ? s : 0, k === 'arrowup' ? -s : k === 'arrowdown' ? s : 0); }
  else if (k === ',') { cur.frame = (cur.frame - 1 + doc.frames.length) % doc.frames.length; fullRefresh(); } else if (k === '.') { cur.frame = (cur.frame + 1) % doc.frames.length; fullRefresh(); }
  else if (k === '?') showHelp();
});
document.addEventListener('keyup', (e) => { if (e.key === ' ') panMode = false; });
function showHelp() { modal('Ajuda e atalhos', `<div class="note"><strong>Apple Pencil:</strong> quando a caneta encosta pela primeira vez, liga "Só Pencil": a caneta desenha, e o dedo e a palma só movem e dão zoom.</div>
  <div class="note"><strong>Gestos (como no Procreate):</strong> pinça dá zoom e move · tocar com dois dedos desfaz e com três refaz · segurar dois ou três dedos desfaz ou refaz em sequência · segurar um dedo parado abre o conta-gotas com lupa.</div>
  <div class="note"><strong>Teclado:</strong> B lápis · E borracha · G balde · I conta-gotas · L linha · U retângulo · O elipse · S seleção · M mover · H mão · X simetria · [ ] tamanho · F tela cheia · C faixa de cores · 0 ajustar · setas movem (⇧ = 8 px) · , . quadros · ⌘Z/⇧⌘Z · ⌘C ⌘X ⌘V · ⌘D duplica camada · ⌘A tudo · Delete limpa · espaço + arrastar move a vista · Alt + clique pega cor.</div>`, [['Fechar', null, 'primary']]); }
