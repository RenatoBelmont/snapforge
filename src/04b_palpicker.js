/* ======================= seletor de paleta com prévia das cores ======================= */
// Botão mostra o nome + uma faixa com as cores; o menu lista cada paleta com todas as cores visíveis.
// opts: { value, auto (inclui "Automática"), doc (inclui "Paleta do editor"), onChange(value) }
let ppOpen = null;
function closePP() { if (ppOpen) { ppOpen.remove(); ppOpen = null; } }
document.addEventListener('pointerdown', (e) => { if (ppOpen && !ppOpen.contains(e.target) && !e.target.closest('.pp-btn')) closePP(); }, true);
const stripHtml = (cols, max = 24) => { if (!cols.length) return '<span class="strip" style="background:linear-gradient(90deg,#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7)"></span>'; const step = Math.max(1, Math.ceil(cols.length / max)); return `<span class="strip">${cols.filter((_, i) => i % step === 0).map(c => `<i style="background:${c}"></i>`).join('')}</span>`; };
function palEntries(opts) {
  const list = [];
  if (opts.auto) list.push({ v: '', name: 'Automática (k-means)', cols: [], hint: 'o Snapper escolhe' });
  if (opts.doc) list.push({ v: '__doc', name: 'Paleta atual do editor', cols: palList(palName), hint: palName });
  for (const n of Object.keys(allPals())) list.push({ v: n, name: n, cols: palList(n), user: !PALETTES[n] });
  return list;
}
function palettePicker(host, opts) {
  let value = opts.value;
  const draw = () => { const e = palEntries(opts).find(x => x.v === value) || palEntries(opts)[0]; value = e.v; host.innerHTML = `<button type="button" class="pp-btn">${stripHtml(e.cols)}<span class="nm">${esc(e.name)}</span>${ico('chevron')}</button>`; };
  host.addEventListener('click', (ev) => {
    if (!ev.target.closest('.pp-btn')) return; if (ppOpen) { closePP(); return; }
    const r = host.getBoundingClientRect(), pop = document.createElement('div'); pop.className = 'pp-pop'; ppOpen = pop;
    pop.innerHTML = palEntries(opts).map(e => `<div class="pp-item${e.v === value ? ' on' : ''}" data-v="${esc(e.v)}" role="button"><span class="h">${esc(e.name)}${e.user ? `<button class="del" data-del="${esc(e.v)}" title="Apagar paleta">${ico('trash')}</button>` : ''}<small>${e.cols.length ? e.cols.length + ' cores' : e.hint || ''}</small></span>${e.cols.length ? `<span class="cells">${e.cols.map(c => `<i style="background:${c}"></i>`).join('')}</span>` : `<span class="hint">${esc(e.hint || '')}</span>`}</div>`).join('');
    document.body.appendChild(pop); const w = Math.max(r.width, 290); pop.style.width = w + 'px'; pop.style.left = clamp(r.left, 8, innerWidth - w - 8) + 'px';
    const below = innerHeight - r.bottom; if (below < 260 && r.top > below) { pop.style.bottom = (innerHeight - r.top + 4) + 'px'; pop.style.maxHeight = (r.top - 12) + 'px'; } else { pop.style.top = (r.bottom + 4) + 'px'; pop.style.maxHeight = (below - 12) + 'px'; }
    pop.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
    pop.addEventListener('click', async (e) => {
      const d = e.target.closest('[data-del]'); if (d) { e.stopPropagation(); const n = d.dataset.del; closePP(); if (await confirmar(`Apagar a paleta "${n}"?`, 'Apagar')) { delete userPals[n]; LS.set('userPals', userPals); if (palName === n) { palName = 'Sweetie 16'; LS.set('palName', palName); } refreshAllPalPickers(); renderColor(); } return; }
      const it = e.target.closest('[data-v]'); if (!it) return; value = it.dataset.v; closePP(); draw(); opts.onChange && opts.onChange(value);
    });
  });
  draw();
  const api = { get: () => value, set: (v) => { value = v; draw(); }, redraw: draw }; ppPickers.push(api); return api;
}
const ppPickers = [];
function refreshAllPalPickers() { ppPickers.forEach(p => p.redraw()); }
