/* ======================= cor: seletor padrão do Waypoint (com toque) ======================= */
function rgbToHsv(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return { h, s: mx ? d / mx : 0, v: mx }; }
function hsvToRgb(h, s, v) { const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c; let r, g, b; if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x]; return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; }
let cpEl = null;
function closeColorPicker() { if (!cpEl) return; cpEl.remove(); cpEl = null; commitColor(); pushRecent(rgb2hex(...st.color.slice(0, 3))); renderColor(); }
function openColorPicker(anchor) {
  if (cpEl) { closeColorPicker(); return; }
  let hsv = rgbToHsv(st.color[0], st.color[1], st.color[2]); const pal = palList(palName);
  cpEl = document.createElement('div'); cpEl.className = 'cp';
  cpEl.innerHTML = `<div class="cp-sq" data-sq><div class="cp-cur" data-cur></div></div><div class="cp-hue" data-hue><i data-ht></i></div>
    <div class="cp-row"><span class="cp-lbl" style="margin:0">HEX</span><input class="input-field" data-hex maxlength="7">${'EyeDropper' in window ? `<button class="tb" data-ed title="Conta-gotas da tela">${ico('pipette')}</button>` : ''}</div>
    <div class="cp-row"><span class="cp-lbl" style="margin:0;width:44px">Opac.</span><input type="range" min="0" max="255" data-alpha value="${st.color[3]}"></div>
    ${recent.length ? `<p class="cp-lbl">Recentes</p><div class="cp-pal">${recent.map(c => `<button style="background:${c}" data-c="${c}"></button>`).join('')}</div>` : ''}
    <p class="cp-lbl">Paleta: ${esc(palName)}</p><div class="cp-pal">${pal.map(c => `<button style="background:${c}" data-c="${c}"></button>`).join('')}</div>
    <p class="cp-lbl">Favoritas</p><div class="cp-pal">${FAVORITES.map(c => `<button style="background:${c}" data-c="${c}"></button>`).join('')}</div>`;
  document.body.appendChild(cpEl);
  const r = anchor.getBoundingClientRect(), H = cpEl.offsetHeight; cpEl.style.left = clamp(r.left, 8, innerWidth - 280) + 'px'; cpEl.style.top = (r.bottom + 6 + H > innerHeight ? Math.max(8, r.top - H - 6) : r.bottom + 6) + 'px';
  const sq = $('[data-sq]', cpEl), curEl = $('[data-cur]', cpEl), hue = $('[data-hue]', cpEl), ht = $('[data-ht]', cpEl), hexIn = $('[data-hex]', cpEl), al = $('[data-alpha]', cpEl);
  const paint = (skipHex) => { const p = hsvToRgb(hsv.h, 1, 1); sq.style.background = rgb2hex(...p); curEl.style.left = hsv.s * 100 + '%'; curEl.style.top = (1 - hsv.v) * 100 + '%'; ht.style.left = hsv.h / 360 * 100 + '%';
    const hx = rgb2hex(...hsvToRgb(hsv.h, hsv.s, hsv.v)); if (!skipHex) hexIn.value = hx.toUpperCase(); $$('[data-c]', cpEl).forEach(b => b.classList.toggle('on', b.dataset.c.toLowerCase() === hx)); };
  const commit = () => { const [R, G, B] = hsvToRgb(hsv.h, hsv.s, hsv.v); setColor([Math.round(R), Math.round(G), Math.round(B), +al.value], true); };
  const drag = (el, fn) => el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); fn(e); const mv = (ev) => fn(ev), up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); }; el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); });
  drag(sq, (e) => { const b = sq.getBoundingClientRect(); hsv.s = clamp((e.clientX - b.left) / b.width, 0, 1); hsv.v = clamp(1 - (e.clientY - b.top) / b.height, 0, 1); paint(); commit(); });
  drag(hue, (e) => { const b = hue.getBoundingClientRect(); hsv.h = clamp((e.clientX - b.left) / b.width, 0, 1) * 359.9; paint(); commit(); });
  hexIn.addEventListener('input', () => { let v = hexIn.value.trim(); if (v[0] !== '#') v = '#' + v; if (/^#[0-9a-f]{6}$/i.test(v)) { hsv = rgbToHsv(...hex2rgb(v)); paint(true); commit(); } });
  al.addEventListener('input', commit);
  cpEl.addEventListener('click', async (e) => { const b = e.target.closest('[data-c]'); if (b) { hsv = rgbToHsv(...hex2rgb(b.dataset.c)); if (+al.value === 0) al.value = 255; paint(); commit(); return; }
    if (e.target.closest('[data-ed]')) { try { const res = await new window.EyeDropper().open(); hsv = rgbToHsv(...hex2rgb(res.sRGBHex)); paint(); commit(); } catch {} } });
  paint();
}
document.addEventListener('pointerdown', (e) => { if (cpEl && !cpEl.contains(e.target) && !e.target.closest('#curColor')) closeColorPicker(); }, true);
