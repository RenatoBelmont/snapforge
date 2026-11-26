const { PNG } = require('pngjs'); const fs = require('fs'); const { execFileSync } = require('child_process');
const E = require('../src/engines.js');
// Caminho dos repositórios da Sprite Fusion compilados com `cargo build --release` (veja CLAUDE.md)
const R = process.env.SF_REPOS || require('path').join(__dirname, '..', '..', 'sf-repos') + '/';
const SN = R + 'spritefusion-pixel-snapper/target/release/spritefusion-pixel-snapper';
const NM = R + 'spritefusion-sprite-normals/target/release/spritefusion-sprite-normals';
const load = (f) => { const p = PNG.sync.read(fs.readFileSync(f)); return { width: p.width, height: p.height, data: new Uint8ClampedArray(p.data) }; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

// ---- Snapper: com paleta fixa e com k cores
const pal = '1a1c2c,ef7d57,ffcd75,38b764,41a6f6,f4f4f4,ff00ff';
for (const [label, args, opts] of [
  ['paleta fixa', ['--palette', pal], { palette: pal }],
  ['16 cores', ['16'], { k_colors: 16 }],
  ['pixel-size 10', ['16', '--pixel-size', '10'], { k_colors: 16, pixel_size_override: 10 }],
  ['4 cores', ['4'], { k_colors: 4 }],
  ['32 cores', ['32'], { k_colors: 32 }],
  ['64 cores', ['64'], { k_colors: 64 }],
]) {
  execFileSync(SN, [require('path').join(__dirname,'fixtures','ai_like.png'), require('path').join(require('os').tmpdir(),'ref_snap.png'), ...args]);
  const ref = load(require('path').join(require('os').tmpdir(),'ref_snap.png')), js = E.snapPixels(load(require('path').join(__dirname,'fixtures','ai_like.png')), opts);
  ok(ref.width === js.width && ref.height === js.height, `snapper ${label}: tamanho ref ${ref.width}x${ref.height} / js ${js.width}x${js.height}`);
  if (ref.width === js.width && ref.height === js.height) {
    // o k-means usa o mesmo ChaCha8(42) e as mesmas contas em f32 do Rust: a saída tem que ser idêntica, byte a byte
    let diff = 0; for (let i = 0; i < ref.data.length; i++) if (ref.data[i] !== js.data[i]) diff++;
    ok(diff === 0, `snapper ${label}: ${diff} bytes diferentes do Rust`);
  }
}

// ---- Normals: determinístico, deve bater ±1
for (const [file, args, opts] of [
  [require('path').join(__dirname,'fixtures','sprite32.png'), [], {}],
  [require('path').join(__dirname,'fixtures','sprite32.png'), ['--normal-strength', '3', '--detail-strength', '2', '--shape-strength', '4', '--detail-scale', '1.5'], { normal_strength: 3, detail_strength: 2, shape_strength: 4, detail_scale: 1.5 }],
  [require('path').join(__dirname,'fixtures','sprite32.png'), ['--normal-format', 'directx'], { directx: true }],
  [require('path').join(__dirname,'fixtures','sheet64.png'), ['--frame-size', '32x32'], { frame_size: [32, 32] }],
]) {
  try { fs.unlinkSync(require('path').join(require('os').tmpdir(),'ref_n.png')); } catch {}
  execFileSync(NM, [file, '-o', require('path').join(require('os').tmpdir(),'ref_n.png'), '--force', ...args]);
  const ref = load(require('path').join(require('os').tmpdir(),'ref_n.png')), js = E.generateNormal(load(file), opts);
  let maxd = 0; for (let i = 0; i < ref.data.length; i++) maxd = Math.max(maxd, Math.abs(ref.data[i] - js.data[i]));
  ok(maxd <= 1, `normals ${file} ${args.join(' ')}: diferença máx por canal = ${maxd}`);
}
console.log(fails ? fails + ' falha(s)' : 'tudo ok');
process.exit(fails ? 1 : 0);
