/* ======================================================================
   NORMAL MAP
   ====================================================================== */
const NCTL = [['normal_strength', 'Força geral', 0, 8, .05, 1.5], ['detail_strength', 'Detalhe do sombreado', 0, 8, .1, 6], ['detail_scale', 'Suavização', 0.6, 8, .1, .6], ['shape_strength', 'Volume da silhueta', 0, 8, .05, 1.15]];
const nOpts = LS.get('nOpts', {});
$('#nCtl').innerHTML = NCTL.map(([k, l, mn, mx, s, d]) => `<label class="lbl">${l}<div class="row"><input type="range" data-k="${k}" min="${mn}" max="${mx}" step="${s}" value="${nOpts[k] ?? d}"><b class="mono" style="width:40px;text-align:right" data-v="${k}">${nOpts[k] ?? d}</b></div></label>`).join('') +
  `<label class="chk"><input type="checkbox" id="nDx"${nOpts.directx ? ' checked' : ''}> Formato DirectX (inverte o verde)</label>
   <label class="lbl">Quadros (sprite sheet)<div class="row"><input class="input-field" id="nFw" placeholder="largura" inputmode="numeric"><span class="muted">×</span><input class="input-field" id="nFh" placeholder="altura" inputmode="numeric"></div><span class="hint">Vazio para um sprite único. Cada quadro é processado separadamente.</span></label>
   <button class="btn sm" id="nReset">Restaurar padrões</button>`;
let nIn = null, nOut = null, nTimer = 0;
$$('#nCtl input[type=range]').forEach(r => r.addEventListener('input', () => { $(`[data-v="${r.dataset.k}"]`).textContent = r.value; queueNormal(); }));
$('#nDx').onchange = queueNormal; $('#nFw').onchange = queueNormal; $('#nFh').onchange = queueNormal;
$('#nReset').onclick = () => { NCTL.forEach(([k, , , , , d]) => { $(`[data-k="${k}"]`).value = d; $(`[data-v="${k}"]`).textContent = d; }); $('#nDx').checked = false; queueNormal(); };
function setNormalInput(img, frame) { nIn = img; $('#nFw').value = frame ? frame[0] : ''; $('#nFh').value = frame ? frame[1] : ''; queueNormal(true); }
bindDrop($('#nDrop'), async (f) => { try { setNormalInput(await withBusy('Abrindo imagem…', () => fileToImage(f)), null); } catch (e) { toast(e.message); } });
$('#nFromEd').onclick = () => setNormalInput(composite(cur.frame), null);
$('#nFromSheet').onclick = () => setNormalInput(sheetImage(), [doc.w, doc.h]);
function queueNormal(now) { clearTimeout(nTimer); nTimer = setTimeout(runNormal, now === true ? 0 : 140); }
async function runNormal() {
  if (!nIn) return; const o = {}; NCTL.forEach(([k]) => o[k] = +$(`[data-k="${k}"]`).value); o.directx = $('#nDx').checked;
  const fw = parseInt($('#nFw').value), fh = parseInt($('#nFh').value); if (fw && fh) o.frame_size = [fw, fh];
  LS.set('nOpts', { ...o, frame_size: undefined });
  try { nOut = nIn.width * nIn.height > 60000 ? await withBusy('Gerando normal map…', () => runEngine('normal', nIn, o), `${nIn.width}×${nIn.height} px`) : await runEngine('normal', nIn, o);
    drawToPane($('#nOut'), nOut); $('#nOutE').style.display = 'none'; $('#nInfo').textContent = `· ${nOut.width}×${nOut.height}${o.frame_size ? ` · quadros ${fw}×${fh}` : ''}`;
    $('#nDl').disabled = false; $('#nToLayer').disabled = !(nOut.width === doc.w && nOut.height === doc.h); drawLit();
  } catch (e) { busy(false); toast('Erro: ' + e.message, 4000); }
}
const lit = { x: .25, y: .25 }, litCv = $('#nLit');
function drawLit() {
  if (!nIn || !nOut) return; const w = nIn.width, h = nIn.height, c = litCv; if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const out = new ImageData(w, h), d = out.data, a = nIn.data, n = nOut.data, lc = hex2rgb($('#nCol').value).map(v => v / 255), amb = +$('#nAmb').value / 100, zH = +$('#nZ').value / 100 * Math.max(w, h) * .5, dx = $('#nDx').checked ? -1 : 1, Lx = lit.x * w, Ly = lit.y * h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; if (!a[o + 3]) continue;
    const nx = n[o] / 127.5 - 1, ny = (n[o + 1] / 127.5 - 1) * dx, nz = n[o + 2] / 127.5 - 1; let lx = Lx - (x + .5), ly = -(Ly - (y + .5)), lz = zH; const ll = Math.hypot(lx, ly, lz) || 1; lx /= ll; ly /= ll; lz /= ll;
    const dist = Math.hypot(Lx - x, Ly - y) / Math.max(w, h), att = 1 / (1 + dist * dist * 3), dif = Math.max(0, nx * lx + ny * ly + nz * lz) * att * 1.6;
    d[o] = a[o] * (amb + dif * lc[0]); d[o + 1] = a[o + 1] * (amb + dif * lc[1]); d[o + 2] = a[o + 2] * (amb + dif * lc[2]); d[o + 3] = a[o + 3]; }
  c.getContext('2d').putImageData(out, 0, 0);
}
const moveLight = (e) => { if (!litCv.width) return; const r = litCv.getBoundingClientRect(), k = Math.min(r.width / litCv.width, r.height / litCv.height), dw = litCv.width * k, dh = litCv.height * k; lit.x = (e.clientX - r.left - (r.width - dw) / 2) / dw; lit.y = (e.clientY - r.top - (r.height - dh) / 2) / dh; drawLit(); };
litCv.addEventListener('pointerdown', (e) => { litCv.setPointerCapture(e.pointerId); moveLight(e); });
litCv.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'mouse') moveLight(e); });
['nCol', 'nAmb', 'nZ'].forEach(id => $('#' + id).addEventListener('input', drawLit));
$('#nDl').onclick = async () => { if (nOut) saveBlob(await canvasBlob(imgToCanvas(nOut)), `normal_${nOut.width}x${nOut.height}${$('#nDx').checked ? '_dx' : ''}.png`); };
$('#nToLayer').onclick = () => { if (nOut) addImageAsLayer(nOut, 'Normal map'); };


setupLoupe('n', $('#nLoupe'));
