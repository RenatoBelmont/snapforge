/* ======================= motores (worker com fallback) ======================= */
const ENGINE_SRC = $('#engines-src').textContent;
let worker = null, jobId = 0; const jobs = new Map();
try {
  const src = ENGINE_SRC + '\nself.onmessage=function(e){var m=e.data;try{var r=m.op==="snap"?PXEngines.snapPixels(m.img,m.opts):PXEngines.generateNormal(m.img,m.opts);self.postMessage({id:m.id,ok:true,img:{width:r.width,height:r.height,data:r.data,pixelSize:r.pixelSize}},[r.data.buffer]);}catch(err){self.postMessage({id:m.id,ok:false,err:String(err&&err.message||err)});}};';
  worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
  worker.onmessage = (e) => { const j = jobs.get(e.data.id); if (!j) return; jobs.delete(e.data.id); e.data.ok ? j.res(e.data.img) : j.rej(new Error(e.data.err)); };
  worker.onerror = () => { worker = null; };
} catch { worker = null; }
function runEngine(op, img, opts) {
  const copy = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
  if (worker) return new Promise((res, rej) => { const id = ++jobId; jobs.set(id, { res, rej }); worker.postMessage({ id, op, img: copy, opts }, [copy.data.buffer]); });
  return new Promise((res, rej) => setTimeout(() => { try { res(op === 'snap' ? PXEngines.snapPixels(copy, opts) : PXEngines.generateNormal(copy, opts)); } catch (e) { rej(e); } }, 30));
}

