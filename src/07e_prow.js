/* ======================= fileira de paleta e LCD ======================= */
// Embaixo do canvas: cor atual, borracha e as cores da paleta como botões grandes, sempre à mão.
// A faixa LCD mostra a cor atual. Redesenhadas por renderFaixa() (toda troca de cor/paleta) e setTool().
function renderPRow() {
  const r = $('#pRow'); if (!r || !doc) return;
  const pal = palList(palName), c = st.color, h = rgb2hex(c[0], c[1], c[2]), er = st.tool === 'eraser';
  r.innerHTML = `<button class="cur checker" data-pr="pick" title="Abrir seletor de cor" aria-label="Cor atual ${h}"><i style="background:rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})"></i></button>`
    + `<button class="er${er ? ' on' : ''}" data-pr="er" title="Borracha (E)" aria-label="Borracha">${ico('eraser')}</button><span class="gap"></span>`
    + pal.map(p => `<button class="c${!er && p === h ? ' on' : ''}" style="background:${p}" data-pc2="${p}" title="${p}" aria-label="Cor ${p}"></button>`).join('');
  const l = $('#lcdCol'); if (l) l.innerHTML = `<i class="lcd-sw" style="background:${h}"></i>${h.toUpperCase()}`;
}
// listener ligado uma vez só (a fileira é redesenhada, o contêiner não)
$('#pRow').addEventListener('click', (e) => {
  const b = e.target.closest('[data-pc2],[data-pr]'); if (!b) return;
  if (b.dataset.pc2) { setColor([...hex2rgb(b.dataset.pc2), 255]); if (!['pencil', 'fill', 'line', 'rect', 'ellipse'].includes(st.tool)) setTool('pencil'); return; }
  if (b.dataset.pr === 'er') setTool('eraser');
  else if (b.dataset.pr === 'pick') openColorPicker(b);
});
