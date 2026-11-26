/* ======================================================================
   EDITOR — documento, histórico, composição
   ====================================================================== */
let doc, cur = { frame: 0, layer: 0 };
const st = { tool: 'pencil', shape: 'rect', color: [26, 28, 44, 255], brush: 1, pixelPerfect: true, fillShape: false, contiguous: true,
  mirrorX: false, mirrorY: false, grid: true, majorGrid: 0, onion: false, zoom: 8, ox: 0, oy: 0, swatch: -1,
  penOnly: LS.get('penOnly', false), penSeen: LS.get('penSeen', false), faixa: LS.get('faixa', true), panel: LS.get('panel', null) };
const newLayerData = () => new Uint8ClampedArray(doc.w * doc.h * 4);
function newDoc(w, h, name) { doc = { name: name || 'Sem título', w, h, fps: 8, layers: [{ name: 'Camada 1', visible: true, opacity: 1, locked: false }], frames: [[null]] }; doc.frames[0][0] = newLayerData(); cur = { frame: 0, layer: 0 }; hist.length = 0; future.length = 0; selRect = null; }
const px = () => doc.frames[cur.frame][cur.layer];
const hist = [], future = [];
function snap() { return { name: doc.name, w: doc.w, h: doc.h, fps: doc.fps, layers: doc.layers.map(l => ({ ...l })), frames: doc.frames.map(f => f.map(a => new Uint8ClampedArray(a))), cur: { ...cur }, sel: selRect ? { ...selRect } : null }; }
function restore(s) { doc = { name: s.name, w: s.w, h: s.h, fps: s.fps, layers: s.layers.map(l => ({ ...l })), frames: s.frames.map(f => f.map(a => new Uint8ClampedArray(a))) }; cur = { ...s.cur }; selRect = s.sel ? { ...s.sel } : null; }
function pushHist() { hist.push(snap()); if (hist.length > 80) hist.shift(); future.length = 0; }
function undo() { if (!hist.length) return toast('Nada para desfazer'); future.push(snap()); restore(hist.pop()); fullRefresh(); }
function redo() { if (!future.length) return toast('Nada para refazer'); hist.push(snap()); restore(future.pop()); fullRefresh(); }
function composite(fi, opts = {}) {
  const out = new Uint8ClampedArray(doc.w * doc.h * 4), fr = doc.frames[fi];
  for (let li = 0; li < doc.layers.length; li++) {
    const L = doc.layers[li]; if (!L.visible && !opts.all) continue; const a = fr[li], op = L.opacity;
    for (let i = 0; i < a.length; i += 4) { const sa = a[i + 3] / 255 * op; if (sa <= 0) continue; const da = out[i + 3] / 255, oa = sa + da * (1 - sa);
      out[i] = (a[i] * sa + out[i] * da * (1 - sa)) / oa; out[i + 1] = (a[i + 1] * sa + out[i + 1] * da * (1 - sa)) / oa; out[i + 2] = (a[i + 2] * sa + out[i + 2] * da * (1 - sa)) / oa; out[i + 3] = oa * 255; }
  }
  return { width: doc.w, height: doc.h, data: out };
}

