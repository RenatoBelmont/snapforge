// Gera entradas de teste: sprite 24x24 "IA" (ampliado com blocos irregulares + ruído) e sprite limpo 32x32 p/ normals
const { PNG } = require('pngjs'); const fs = require('fs');
function save(name, w, h, data) { name = require('path').join(__dirname, name); const p = new PNG({ width: w, height: h }); p.data = Buffer.from(data); fs.writeFileSync(name, PNG.sync.write(p)); }
let s = 7; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
const pal = [[26,28,44],[239,125,87],[255,205,117],[56,183,100],[65,166,246],[244,244,244]];
const N = 24, spr = [];
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const dx = x - 11.5, dy = y - 11.5, r = Math.hypot(dx, dy);
  let c = -1;
  if (r < 10) c = r > 8.6 ? 0 : (dx + dy < -6 ? 2 : (dx + dy > 6 ? 1 : 3));
  if (x > 9 && x < 14 && y > 4 && y < 9) c = 5;
  spr.push(c);
}
// ampliação irregular: cada célula tem largura 10 ou 11 (≈10.6), com ruído e borda suave
const colW = [], rowH = []; for (let i = 0; i < N; i++) { colW.push(rnd() < 0.6 ? 11 : 10); rowH.push(rnd() < 0.6 ? 11 : 10); }
const W = colW.reduce((a, b) => a + b), H = rowH.reduce((a, b) => a + b), d = new Uint8Array(W * H * 4);
let yy = 0;
for (let cy = 0; cy < N; cy++) { let xx = 0; for (let cx = 0; cx < N; cx++) {
  const c = spr[cy * N + cx];
  for (let y = yy; y < yy + rowH[cy]; y++) for (let x = xx; x < xx + colW[cx]; x++) {
    const o = (y * W + x) * 4;
    const col = c < 0 ? [255, 0, 255] : pal[c];
    const n = (rnd() - 0.5) * 18;
    d[o] = Math.max(0, Math.min(255, col[0] + n)); d[o + 1] = Math.max(0, Math.min(255, col[1] + n)); d[o + 2] = Math.max(0, Math.min(255, col[2] + n)); d[o + 3] = 255;
  }
  xx += colW[cx]; } yy += rowH[cy]; }
save('ai_like.png', W, H, d);
// sprite limpo 32x32 com transparência para normals (2 ilhas)
const M = 32, e = new Uint8Array(M * M * 4);
for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
  const o = (y * M + x) * 4, r = Math.hypot(x - 12, y - 14);
  if (r < 10) { const v = 120 + Math.round((10 - r) * 10) - (x > 14 ? 30 : 0); e[o] = v; e[o + 1] = v * 0.6; e[o + 2] = 60; e[o + 3] = 255; }
  else if (x > 24 && x < 30 && y > 3 && y < 28) { e[o] = 90 + (y % 4) * 20; e[o + 1] = 140; e[o + 2] = 200; e[o + 3] = 255; }
}
save('sprite32.png', M, M, e);
// sheet 64x32 com 2 quadros
const S = new Uint8Array(64 * 32 * 4);
for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) { const src = (y * 32 + (x % 32)) * 4; S.set(e.subarray(src, src + 4), (y * 64 + x) * 4); }
save('sheet64.png', 64, 32, S);
console.log('ai_like', W, H);
