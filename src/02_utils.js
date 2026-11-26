/* ======================= utilidades ======================= */
const toast = (m, ms = 2400) => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), ms); };
const busy = (on, txt, sub) => { const b = $('#busy'); if (on) { $('#busyTxt').textContent = txt || 'Processando…'; $('#busySub').textContent = sub || ''; b.classList.add('on'); } else b.classList.remove('on'); };
const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
/** Mostra o card de carregamento no meio da tela enquanto `fn` roda (espera 2 quadros para o card aparecer antes de trabalho pesado). */
async function withBusy(txt, fn, sub) { busy(true, txt, sub); await nextFrame(); try { return await fn(); } finally { busy(false); } }
const hex2rgb = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const rgb2hex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
try { if (!localStorage.getItem('snapforge.migrated')) { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('pixelaria.') && localStorage.getItem('snapforge.' + k.slice(10)) == null) localStorage.setItem('snapforge.' + k.slice(10), localStorage.getItem(k)); } localStorage.setItem('snapforge.migrated', '1'); } } catch {}
const LS = { get(k, d) { try { const v = localStorage.getItem('snapforge.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
             set(k, v) { try { localStorage.setItem('snapforge.' + k, JSON.stringify(v)); return true; } catch { return false; } },
             del(k) { try { localStorage.removeItem('snapforge.' + k); } catch {} } };
function modal(title, html, buttons) {
  const box = $('#mBox'); box.innerHTML = `<h3>${esc(title)}</h3><div class="stack">${html}</div>`;
  const row = document.createElement('div'); row.className = 'row wrap'; row.style.justifyContent = 'flex-end';
  return new Promise((res) => {
    const done = (v) => { $('#modal').classList.remove('on'); modal.cancel = null; res(v); };
    modal.cancel = () => done(null);
    for (const [label, val, cls] of buttons) { const b = document.createElement('button'); b.className = cls === 'primary' ? 'btn pri' : 'btn'; b.textContent = label; b.onclick = () => done(val === '__form' ? box : val); row.appendChild(b); }
    box.appendChild(row); $('#modal').classList.add('on');
    const first = box.querySelector('input:not([type=checkbox]),select'); if (first && !('ontouchstart' in window)) first.focus();
  });
}
$('#modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal' && modal.cancel) modal.cancel(); });
const confirmar = async (msg, ok = 'Continuar') => !!(await modal('Confirmar', `<p class="sec" style="line-height:1.5">${esc(msg)}</p>`, [['Cancelar', false], [ok, true, 'primary']]));
function imgToCanvas(img) { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0); return c; }
function drawToPane(cv, img) { cv.width = img.width; cv.height = img.height; cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0); }
function fileToImage(file) {
  return new Promise((res, rej) => { const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0); URL.revokeObjectURL(url); res({ width: c.width, height: c.height, data: x.getImageData(0, 0, c.width, c.height).data }); };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Não consegui ler essa imagem')); }; im.src = url; });
}
const b64ToImage = (b64, mime = 'image/png') => fetch(`data:${mime};base64,${b64}`).then(r => r.blob()).then(fileToImage);
function pickFile(accept) { return new Promise((res) => { const f = $('#fileIn'); f.accept = accept; f.value = ''; f.onchange = () => res(f.files[0] || null); f.click(); }); }
function bindDrop(el, cb) {
  el.addEventListener('click', async () => { const f = await pickFile('image/png,image/jpeg,image/gif,image/webp'); if (f) cb(f); });
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) cb(f); });
}
async function saveBlob(blob, name) {
  try { if (navigator.canShare && 'ontouchend' in document && /iPad|iPhone|Macintosh/.test(navigator.userAgent)) { const file = new File([blob], name, { type: blob.type }); if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const canvasBlob = (c) => new Promise(r => c.toBlob(r, 'image/png'));
function scaled(img, s) { const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(imgToCanvas(img), 0, 0, c.width, c.height); return c; }
function fitImage(img, w, h) { const out = new Uint8ClampedArray(w * h * 4), ox = Math.floor((w - img.width) / 2), oy = Math.floor((h - img.height) / 2);
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { const tx = x + ox, ty = y + oy; if (tx < 0 || ty < 0 || tx >= w || ty >= h) continue; const s = (y * img.width + x) * 4; out.set(img.data.subarray(s, s + 4), (ty * w + tx) * 4); }
  return { width: w, height: h, data: out }; }
function keyMagenta(img, tol = 60) { const d = new Uint8ClampedArray(img.data); for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 255) + d[i + 1] + Math.abs(d[i + 2] - 255) < tol) d[i + 3] = 0; return { width: img.width, height: img.height, data: d }; }
function trimAlpha(img) { const d = new Uint8ClampedArray(img.data); for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 128 ? 0 : 255; return { width: img.width, height: img.height, data: d }; }
const slug = () => (doc.name || 'snapforge').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'snapforge';

