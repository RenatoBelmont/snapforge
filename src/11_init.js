/* ======================================================================
   NAVEGAÇÃO, TEMA, INICIALIZAÇÃO
   ====================================================================== */
let tileFitted = false;
function showView(v) {
  $$('.tab').forEach(t => t.classList.toggle('on', t.dataset.v === v)); $$('.view').forEach(x => x.classList.toggle('on', x.id === 'v-' + v)); LS.set('view', v);
  if (v === 'editor') requestAnimationFrame(resizeCanvas);
  if (v === 'vfx') vfxShow();
  if (v === 'tile') requestAnimationFrame(() => { tResize(); if (!tileFitted) { tFit(); tileFitted = true; } renderTileset(); });
}
$('#tabs').addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (t) showView(t.dataset.v); });
function setTheme(dark) { document.documentElement.classList.toggle('dark', dark); $('#themeBtn').innerHTML = ico(dark ? 'sun' : 'moon'); $('#themeBtn').title = dark ? 'Tema claro' : 'Tema escuro'; LS.set('dark', dark); const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#222128' : '#dcd8cf'; /* cor da carcaça */ render(); if (tm) tRender(); }
$('#themeBtn').onclick = () => setTheme(!document.documentElement.classList.contains('dark'));
// sem zoom da página no iPad (Ponto Cruz)
['gesturestart', 'gesturechange', 'gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
let ultToque = 0; document.addEventListener('touchend', (e) => { const t = Date.now(); if (e.cancelable && t - ultToque < 320 && !e.target.closest('button,input,textarea,select,label,a,.layer')) e.preventDefault(); ultToque = t; }, { passive: false });

// salva na hora quando o app vai para segundo plano ou fecha (no iPad, trocar de app não dispara "unload")
function flushSaves() { if (dirtyT) { clearTimeout(dirtyT); dirtyT = 0; setStatus(LS.set('doc', serialize()) ? 'saved' : 'error'); } if (tSaveT) { clearTimeout(tSaveT); tSaveT = 0; if (tm) LS.set('tilemap', tSerialize()); } }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSaves(); });
window.addEventListener('pagehide', flushSaves); window.addEventListener('beforeunload', flushSaves);

(function init() {
  $('#ver').textContent = 'v' + VERSION; paintIcons(); setTheme(LS.get('dark', true));
  try { const saved = LS.get('doc', null); if (saved) deserialize(saved); else newDoc(32, 32); } catch { newDoc(32, 32); }
  const p0 = palList(palName)[0]; st.color = p0 ? [...hex2rgb(p0), 255] : [0, 0, 0, 255]; const p1 = palList(palName).at(-1); st.color2 = p1 ? [...hex2rgb(p1), 255] : [255, 255, 255, 255];
  buildRail(); buildSide(); setTool('pencil'); renderSubtitle(); updateBar(); setStatus('saved');
  initTilemap();
  let lastW = 0; new ResizeObserver(() => { if (!viewOn('editor')) return; const w = area.clientWidth; resizeCanvas(); if (lastW && Math.abs(w - lastW) > 60) fit(); lastW = w; }).observe(area);
  const v0 = LS.get('view', 'editor'); showView(['editor', 'tile', 'snap', 'normal', 'vfx'].includes(v0) ? v0 : 'editor'); // 'gerar' (aba de IA da 1.1) e lixo caem no editor
  requestAnimationFrame(() => { resizeCanvas(); fit(); });
  setTimeout(() => document.body.classList.toggle('boot', false), 900); // o LCD acende uma vez, ao abrir; trocar de aba não repete
})();
