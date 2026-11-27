/* ======================================================================
   VFX — motor de efeitos animados em pixel art (código próprio do Snapforge)
   Cada quadro é desenhado no tamanho real do pixel em três camadas:
     L[slot]  luz (energia somada; vira degraus da rampa de cor, sempre opaca)
     M/Ms     fumaça (densidade + tom; translúcida em 4 níveis, ou pontilhada no "alfa duro")
     P        pixels sólidos (ícones de status, moeda, folhas, pedras)
   + brilho: desfoque da luz, translúcido em degraus.
   Unidades do desenho: o quadro vai de −32 a +32 nos dois eixos (64 unidades), escaladas pelo tamanho e pela "Escala".
   Partículas têm posição analítica (sem simulação passo a passo): o mesmo quadro sai igual sempre, com a mesma semente.
   Efeitos em laço (loop) nascem partículas em [0, T) e usam a idade módulo T, então o último quadro emenda no primeiro.
   ====================================================================== */
const VFX_RAMPS = {
  'Fogo': ['#2b0c0b', '#5e170f', '#9a2a12', '#d65113', '#f3901f', '#ffcb4f', '#fff2b3'],
  'Gelo': ['#0a1931', '#113764', '#1d65a4', '#3a9cd6', '#7bcfee', '#c3efff', '#ffffff'],
  'Elétrico': ['#120c34', '#281e7e', '#3a4bd4', '#4c9cff', '#8cddff', '#dffaff', '#ffffff'],
  'Veneno': ['#0e1909', '#223e0f', '#3c6c16', '#64a41e', '#a2d930', '#defd79'],
  'Arcano': ['#190a2d', '#3b1264', '#6721a5', '#9d3fdf', '#d27bff', '#f3c6ff', '#ffffff'],
  'Sagrado': ['#382810', '#78581a', '#bd8e2f', '#eec64e', '#ffe78e', '#fffadf', '#ffffff'],
  'Sombra': ['#07050d', '#191127', '#2c1e46', '#482e6e', '#6c449e'],
  'Neon': ['#290a29', '#68105e', '#ae1f8e', '#ee3fae', '#ff87d6', '#ffcff0'],
  'Sangue': ['#190408', '#480a11', '#7e0f1b', '#b51f29', '#de3f3f', '#ff7f6f'],
  'Água': ['#08192d', '#0e395e', '#19699a', '#2e9fcf', '#6fcfef', '#c7f3ff'],
  'Folha': ['#0c190d', '#163317', '#215123', '#34742f', '#4e9939', '#7bbf47', '#b3df6f'],
  'Terra': ['#19110b', '#392717', '#5b3f25', '#7f5f39', '#a78357', '#cfaf7f'],
  'Poeira': ['#1b150f', '#392d1f', '#5d4b35', '#856f4e', '#af9973', '#dbc9a1'],
  'Fumaça': ['#111115', '#25252d', '#3b3b47', '#575765', '#797987', '#9f9fab', '#c7c7cf'],
  'Ouro': ['#291905', '#5b390a', '#9f690f', '#df9f17', '#ffcf3f', '#ffef8f', '#ffffff'],
  'Cura': ['#052911', '#0e5925', '#1e8f3f', '#3fc75f', '#7fef8f', '#cfffd7', '#ffffff'],
  'Aço': ['#13151b', '#2b313f', '#495367', '#758199', '#a7b3c7', '#dfe7f3', '#ffffff'],
  'Rosa': ['#2a0d1a', '#5c1a36', '#9c2e5a', '#d84f86', '#f78fb3', '#ffd0e0'],
};
const VTAU = Math.PI * 2;
const vEase = { out: t => 1 - (1 - t) ** 3, out4: t => 1 - (1 - t) ** 4, in: t => t * t, back: t => { const u = t - 1; return 1 + 2.7 * u * u * u + 1.7 * u * u; } };
// gerador com semente (mulberry32)
function vRng(seed) { let s = (seed >>> 0) || 1; const f = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.r = (a, b) => a + (b - a) * f(); f.i = (a, b) => Math.floor(f.r(a, b + 1)); f.s = () => (f() < .5 ? -1 : 1); f.pick = (a) => a[Math.floor(f() * a.length)]; return f; }
const vHash = (x, y, s) => { let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1); h = Math.imul(h ^ (h >>> 15), 0x85ebca77); h ^= h >>> 13; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vNoise = (x, y, s) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), a = vHash(ix, iy, s), b = vHash(ix + 1, iy, s), c = vHash(ix, iy + 1, s), d = vHash(ix + 1, iy + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);

/* ---------- primitivas (coordenadas em unidades; c = contexto do quadro) ---------- */
function vPut(c, slot, i, v) { const L = c.L[slot]; const o = L[i]; L[i] = o > v ? o + v * .25 : v + o * .25; }
function vDisc(c, slot, x, y, r, e) {
  if (e <= 0) return; const cx = c.S / 2 + (x + c.ox) * c.k, cy = c.S / 2 + (y + c.oy) * c.k, R = r * c.k, S = c.S;
  if (R < .75) { const px = Math.floor(cx), py = Math.floor(cy); if (px >= 0 && py >= 0 && px < S && py < S) vPut(c, slot, py * S + px, e); return; }
  const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(S - 1, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(S - 1, Math.ceil(cy + R));
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) { const d = Math.hypot(px + .5 - cx, py + .5 - cy) / R; if (d < 1) vPut(c, slot, py * S + px, e * (1 - d * d * .62)); }
}
function vLine(c, slot, x0, y0, x1, y1, r0, r1, e0, e1) {
  const len = Math.hypot(x1 - x0, y1 - y0) * c.k, n = Math.max(1, Math.ceil(len * 1.5));
  for (let j = 0; j <= n; j++) { const u = j / n; vDisc(c, slot, x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, r0 + (r1 - r0) * u, e0 + (e1 - e0) * u); }
}
/** anel (ou arco de a0 a a1, em radianos). sy achata em elipse. taper: o arco afina nas pontas e brilha mais na frente (corte). */
function vRing(c, slot, x, y, r, w, e, o = {}) {
  if (e <= 0 || r <= 0) return; const sy = o.sy || 1, a0 = o.a0 ?? 0, span = o.span ?? VTAU, S = c.S, cx = c.S / 2 + (x + c.ox) * c.k, cy = c.S / 2 + (y + c.oy) * c.k, R = r * c.k, W = Math.max(.6, w * c.k / 2);
  const x0 = Math.max(0, Math.floor(cx - R - W - 1)), x1 = Math.min(S - 1, Math.ceil(cx + R + W + 1)), y0 = Math.max(0, Math.floor(cy - (R + W) * sy - 1)), y1 = Math.min(S - 1, Math.ceil(cy + (R + W) * sy + 1));
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
    const dx = px + .5 - cx, dy = (py + .5 - cy) / sy, d = Math.hypot(dx, dy); let ww = W, ee = e;
    if (span < VTAU) { let a = Math.atan2(dy, dx) - a0; a = ((a % VTAU) + VTAU) % VTAU; if (a > span) continue; const u = a / span; if (o.taper) { ww = W * Math.sin(Math.PI * u) ** .6; ee = e * (.45 + .55 * u); } }
    const q = Math.abs(d - R) / Math.max(.5, ww); if (q < 1) vPut(c, slot, py * S + px, ee * (1 - q * q * .55));
  }
}
function vSmoke(c, x, y, r, dens, shade) {
  if (dens <= 0) return; const cx = c.S / 2 + (x + c.ox) * c.k, cy = c.S / 2 + (y + c.oy) * c.k, R = Math.max(.8, r * c.k), S = c.S, sd = c.seed & 1023;
  const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(S - 1, Math.ceil(cx + R)), y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(S - 1, Math.ceil(cy + R));
  for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) { const d = Math.hypot(px + .5 - cx, py + .5 - cy) / R; if (d >= 1) continue; const i = py * S + px, m = dens * (1 - d * d) * (.7 + .6 * vNoise((px - cx) / (2 + R * .3) + x, (py - cy) / (2 + R * .3) + y, sd)); c.M[i] = Math.min(1.3, c.M[i] + m); c.Ms[i] += m * (shade - d * .25); }
}
/** estrela de 4 pontas (brilho) */
function vSpark(c, slot, x, y, len, e) { vLine(c, slot, x - len, y, x + len, y, .35, .35, e * .7, e * .7); vLine(c, slot, x, y - len, x, y + len, .35, .35, e * .7, e * .7); vDisc(c, slot, x, y, .7, e); }
/** raio: deslocamento do ponto médio + galhos; `R` é um gerador (muda a forma a cada sorteio) */
function vBolt(c, slot, x0, y0, x1, y1, e, R, jag = .35, branch = .3, depth = 5) {
  let pts = [[x0, y0], [x1, y1]];
  for (let d = 0; d < depth; d++) { const n = [pts[0]]; for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / (L || 1), ny = (bx - ax) / (L || 1), off = (R() - .5) * L * jag; n.push([(ax + bx) / 2 + nx * off, (ay + by) / 2 + ny * off], pts[i]); } pts = n; }
  for (let i = 1; i < pts.length; i++) vLine(c, slot, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], .4, .4, e, e);
  if (branch > 0) for (let i = 2; i < pts.length - 2; i += 2) if (R() < branch) { const [bx, by] = pts[i], ang = Math.atan2(y1 - y0, x1 - x0) + R.s() * R.r(.5, 1.1), L = Math.hypot(x1 - x0, y1 - y0) * R.r(.15, .3); vBolt(c, slot, bx, by, bx + Math.cos(ang) * L, by + Math.sin(ang) * L, e * .75, R, jag, 0, 3); }
}
const VGLYPH = {
  heart: ['.#.#.', '#####', '#####', '.###.', '..#..'], star: ['..#..', '.###.', '#####', '.###.', '##.##'], z: ['####', '..#.', '.#..', '####'],
  excl: ['##', '##', '##', '##', '..', '##'], up: ['..#..', '.###.', '#####', '..#..', '..#..'], down: ['..#..', '..#..', '#####', '.###.', '..#..'],
  plus: ['.#.', '###', '.#.'], skull: ['.###.', '#####', '#.#.#', '#####', '.#.#.'], drop: ['..#..', '.###.', '#####', '#####', '.###.'],
  leaf: ['..#', '.##', '##.', '#..'], rock: ['.##.', '####', '###.'], chip: ['###'], diamond: ['.#.', '###', '.#.'],
};
/** pinta um ícone em pixels sólidos: corpo nas cores claras da rampa, linha de cima mais clara, contorno de 1 px na cor escura */
function vGlyph(c, slot, name, x, y, a = 1, mul = 1) {
  if (a <= 0) return; const g = VGLYPH[name], ramp = c.ramps[slot], n = ramp.length, p = Math.max(1, Math.round(c.k * mul * 2)), W = g[0].length * p, H = g.length * p;
  const ox = Math.round(c.S / 2 + (x + c.ox) * c.k - W / 2), oy = Math.round(c.S / 2 + (y + c.oy) * c.k - H / 2), on = (px, py) => px >= 0 && py >= 0 && px < W && py < H && g[(py / p) | 0][(px / p) | 0] === '#';
  for (let py = -1; py <= H; py++) for (let px = -1; px <= W; px++) {
    let col; if (on(px, py)) col = ramp[!on(px, py - 1) ? n - 1 : !on(px, py + 1) ? n - 3 : n - 2];
    else if (on(px - 1, py) || on(px + 1, py) || on(px, py - 1) || on(px, py + 1)) col = ramp[1]; else continue;
    const [r, gg, b] = c.rgb(col); vSolid(c, ox + px, oy + py, r, gg, b, a);
  }
}
function vSolid(c, px, py, r, g, b, a) { if (px < 0 || py < 0 || px >= c.S || py >= c.S) return; const i = (py * c.S + px) * 4, P = c.P; if (a >= P[i + 3] / 255 || P[i + 3] === 0) { P[i] = r; P[i + 1] = g; P[i + 2] = b; P[i + 3] = Math.round(a * 255); } }
/** elipse sólida (moeda) com contorno e brilho */
function vCoin(c, slot, x, y, rx, ry, a) {
  const ramp = c.ramps[slot], n = ramp.length, cx = c.S / 2 + (x + c.ox) * c.k, cy = c.S / 2 + (y + c.oy) * c.k, RX = Math.max(.6, rx * c.k), RY = ry * c.k;
  for (let py = Math.floor(cy - RY - 1); py <= cy + RY + 1; py++) for (let px = Math.floor(cx - RX - 1); px <= cx + RX + 1; px++) {
    const dx = (px + .5 - cx) / RX, dy = (py + .5 - cy) / RY, d = dx * dx + dy * dy, dO = ((px + .5 - cx) / (RX + 1)) ** 2 + ((py + .5 - cy) / (RY + 1)) ** 2; let col;
    if (d < 1) col = ramp[dx < -.35 ? n - 1 : d < .35 && rx > 2 ? n - 3 : n - 2]; else if (dO < 1) col = ramp[1]; else continue; const [r, g, b] = c.rgb(col); vSolid(c, px, py, r, g, b, a);
  }
}

/* ---------- partículas ---------- */
/** cria n partículas (n já multiplicado pela densidade). o: ang [a0,a1], spd, life, t0, r, drag, gy, x/y (jitter), e, kind, slot */
function vParts(R, n, o) {
  const out = [], rg = (v, d) => Array.isArray(v) ? R.r(v[0], v[1]) : v ?? d;
  for (let j = 0; j < n; j++) { const a = rg(o.ang, R.r(0, VTAU)), s = rg(o.spd, 20), ox = rg(o.x, 0), oy = rg(o.y, 0);
    out.push({ x: ox, y: oy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t0: rg(o.t0, 0), life: rg(o.life, .6), r: rg(o.r, 1), drag: rg(o.drag, 0), gy: rg(o.gy, 0), gx: rg(o.gx, 0), e: rg(o.e, 1), kind: o.kind || 'dot', slot: o.slot || 0, grow: rg(o.grow, 2), shade: rg(o.shade, .6), tr: rg(o.tr, .06), wob: rg(o.wob, 0), ph: R.r(0, VTAU), glyph: o.glyph, fade: o.fade ?? 1, shrink: o.shrink ?? 1 }); }
  return out;
}
const vPos = (p, a) => { const f = p.drag ? (1 - Math.exp(-p.drag * a)) / p.drag : a; return [p.x + p.vx * f + .5 * p.gx * a * a + (p.wob ? Math.sin(a * 9 + p.ph) * p.wob : 0), p.y + p.vy * f + .5 * p.gy * a * a]; };
/** desenha as partículas vivas no tempo t; com loop = T, a idade dá a volta e o laço emenda */
function vDraw(c, ps, loop) {
  for (const p of ps) {
    let a = c.t - p.t0; if (loop) a = ((a % loop) + loop) % loop; if (a < 0 || a > p.life) continue; const u = a / p.life, [x, y] = vPos(p, a);
    if (p.kind === 'dot') vDisc(c, p.slot, x, y, p.r * (1 - u * .8 * p.shrink), p.e * (1 - u * .75 * p.fade));
    else if (p.kind === 'streak') { const [bx, by] = vPos(p, Math.max(0, a - p.tr)); vLine(c, p.slot, bx, by, x, y, p.r * .4, p.r * (1 - u * .6), p.e * .35 * (1 - u * p.fade), p.e * (1 - u * .7 * p.fade)); }
    else if (p.kind === 'smoke') vSmoke(c, x, y, p.r * (1 + u * p.grow), (1 - u) ** 1.2 * 1.15 * p.e, p.shade * (1 - u * .4));
    else if (p.kind === 'spark') vSpark(c, p.slot, x, y, p.r * (u < .5 ? u * 2 : (1 - u) * 2), p.e);
    else if (p.kind === 'ring') vRing(c, p.slot, x, y, p.r * (.6 + u * .4), .9, p.e * (1 - u * .5));
    else if (p.kind === 'glyph') vGlyph(c, p.slot, p.glyph, x, y, u > .7 ? (1 - u) / .3 : 1);
  }
}

/* ---------- catálogo ---------- */
const VFX = [];
const vfxAdd = (cat, id, name, ramps, dur, frames, make, extra) => VFX.push(Object.assign({ cat, id, name, ramps, dur, frames, make }, extra));
const VCATS = ['Explosões', 'Golpes', 'Cortes', 'Fogo e fumaça', 'Magia', 'Raios', 'Projéteis', 'Água e natureza', 'Coletáveis', 'Status'];
const vN = (o, n) => Math.max(1, Math.round(n * o.dens));
const vUP = -Math.PI / 2;

// --- Explosões
function vBlast(R, o, k = 1, opt = {}) {
  const sp = vParts(R, vN(o, 14 * k), { spd: [30 * k, 70 * k], life: [.25, .5], drag: 4, r: [.8, 1.4], kind: 'streak', tr: .05, e: 1.2 }),
    sm = opt.smoke === false ? [] : vParts(R, vN(o, 9 * k), { spd: [6 * k, 16 * k], life: [.6, 1], t0: [.08, .2], drag: 2.5, r: [3 * k, 5 * k], grow: 1.2, kind: 'smoke', gy: -10, shade: [.35, .7] });
  return (c) => { const t = c.t, f = clamp(t / .35, 0, 1);
    if (t < .06) vDisc(c, 0, 0, 0, 14 * k, 1.4);
    vDisc(c, 0, 0, 0, (5 + 9 * vEase.out(f)) * k * (1 - clamp((t - .3) / .35, 0, 1)), 1.25 - f * .55);
    if (t < .45) vRing(c, 0, 0, 0, vEase.out(t / .45) * 26 * k, 2.2 * (1 - t / .45) + .6, .9 * (1 - t / .45));
    vDraw(c, sm); vDraw(c, sp); };
}
vfxAdd('Explosões', 'blast', 'Explosão', ['Fogo', 'Fumaça'], 1, 12, (R, o) => vBlast(R, o), { smoke: 1 });
vfxAdd('Explosões', 'small', 'Estouro pequeno', ['Fogo'], .6, 8, (R, o) => vBlast(R, o, .55, { smoke: false }));
vfxAdd('Explosões', 'big', 'Explosão grande', ['Fogo', 'Fumaça'], 1.8, 20, (R, o) => { const subs = [0, .12, .22, .35].map((d, j) => ({ d, x: j ? R.r(-12, 12) : 0, y: j ? R.r(-10, 6) : 0, f: vBlast(vRng(R.i(1, 1e9)), o, j ? .7 : 1.15) }));
  return (c) => { const t = c.t, ox = c.ox, oy = c.oy; for (const s of subs) if (t >= s.d) { c.t = t - s.d; c.ox = ox + s.x; c.oy = oy + s.y; s.f(c); } c.t = t; c.ox = ox; c.oy = oy; }; }, { smoke: 1 });
vfxAdd('Explosões', 'plasma', 'Explosão de plasma', ['Elétrico'], .9, 12, (R, o) => { const sp = vParts(R, vN(o, 16), { spd: [40, 75], life: [.2, .4], drag: 5, r: 1, kind: 'streak', e: 1.2 }), bolts = Array.from({ length: vN(o, 6) }, () => R.r(0, VTAU));
  return (c) => { const t = c.t, f = vEase.out(clamp(t / .5, 0, 1)), fr = vRng(c.seed + c.i * 31);
    vDisc(c, 0, 0, 0, 9 * (1 - f) + 2, 1.3 - f * .6); const fo = 1 - clamp((t - .35) / .45, 0, 1); vRing(c, 0, 0, 0, f * 24, 2.5 * (1 - f) + .5, (1 - f * .6) * fo); vRing(c, 0, 0, 0, f * 15, 1, (.9 - f * .7) * fo);
    if (t < .45) for (const a of bolts) vBolt(c, 0, 0, 0, Math.cos(a + t) * 22 * f + Math.cos(a) * 4, Math.sin(a + t) * 22 * f + Math.sin(a) * 4, 1 - t, fr, .5, 0, 3);
    vDraw(c, sp); }; });
vfxAdd('Explosões', 'ground', 'Explosão no chão', ['Fogo', 'Poeira'], 1.3, 16, (R, o) => { const deb = vParts(R, vN(o, 12), { ang: [vUP - 1, vUP + 1], spd: [30, 60], life: [.5, .9], gy: 120, r: [.8, 1.3], kind: 'streak', e: 1.1, y: 12 }),
    dust = vParts(R, vN(o, 12), { ang: 0, spd: [8, 30], life: [.6, 1.2], t0: [0, .15], drag: 3, r: [3, 5], grow: 1, kind: 'smoke', y: [10, 14], shade: [.4, .75] }); dust.forEach(p => { p.vx *= R.s(); p.vy = -R.r(0, 6); });
  return (c) => { const t = c.t, f = vEase.out(clamp(t / .4, 0, 1)), fade = 1 - clamp((t - .35) / .5, 0, 1);
    for (let j = 0; j < 4; j++) vDisc(c, 0, (j - 1.5) * 4 * f, 12 - f * (6 + 6 * Math.cos((j - 1.5) * .8)), (5 + 4 * f) * fade, 1.2 * fade);
    if (t < .4) vRing(c, 0, 0, 13, f * 26, 1.6, .9 * (1 - t / .4), { sy: .3 }); vDraw(c, dust); vDraw(c, deb); }; }, { smoke: 1 });

// --- Golpes
function vStar(c, slot, n, r0, r1, e, rot = 0, w = 1) { for (let j = 0; j < n; j++) { const a = rot + j / n * VTAU, L = j % 2 ? r1 * .6 : r1; vLine(c, slot, Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * L, Math.sin(a) * L, w, .35, e, e * .6); } }
vfxAdd('Golpes', 'hit', 'Impacto', ['Ouro'], .45, 7, (R, o) => { const rot = R.r(0, 1), sp = vParts(R, vN(o, 6), { spd: [40, 70], life: [.15, .3], drag: 6, r: .8, kind: 'streak', e: 1 });
  return (c) => { const u = c.t / .45, g = vEase.back(clamp(u * 2.2, 0, 1)); vDisc(c, 0, 0, 0, 5 * (1 - u), 1.3); vStar(c, 0, 8, 3 + u * 6, 6 + g * 12 * (1 - u * .5), 1.2 - u * .6, rot, 1.4 * (1 - u) + .4); vDraw(c, sp); }; });
vfxAdd('Golpes', 'crit', 'Golpe crítico', ['Ouro', 'Fogo'], .75, 10, (R, o) => { const rot = R.r(0, 1), sp = vParts(R, vN(o, 12), { spd: [45, 85], life: [.25, .45], drag: 5, r: 1, kind: 'streak', e: 1.2, slot: 1 }), sk = vParts(R, vN(o, 5), { spd: [10, 20], life: [.3, .5], t0: [.1, .25], r: [2, 3.5], kind: 'spark', e: 1.2 });
  return (c) => { const u = c.t / .75, g = vEase.back(clamp(u * 3, 0, 1)); if (c.t < .05) vDisc(c, 0, 0, 0, 12, 1.5); vRing(c, 1, 0, 0, vEase.out(clamp(u * 1.6, 0, 1)) * 24, 1.6 * (1 - u), 1 - u); vStar(c, 0, 12, 4 + u * 8, 8 + g * 17 * (1 - u * .4), 1.3 - u * .7, rot, 1.8 * (1 - u) + .4); vDraw(c, sp); vDraw(c, sk); }; });
vfxAdd('Golpes', 'block', 'Faísca de bloqueio', ['Ouro', 'Aço'], .5, 8, (R, o) => { const sp = vParts(R, vN(o, 14), { ang: [-2.6, -.5], spd: [40, 80], life: [.2, .45], gy: 160, r: .8, kind: 'streak', tr: .04, e: 1.3 });
  return (c) => { const u = c.t / .5; vDisc(c, 1, 0, 0, 6 * (1 - u), 1.4); vLine(c, 1, -10 * (1 - u), 0, 10 * (1 - u), 0, .6, .6, 1.2 * (1 - u), 1.2 * (1 - u)); vDraw(c, sp); }; });
vfxAdd('Golpes', 'blood', 'Sangue', ['Sangue'], .8, 10, (R, o) => { const dr = vParts(R, vN(o, 16), { ang: [-.9, .5], spd: [25, 70], life: [.4, .75], gy: 140, r: [.8, 1.6], kind: 'dot', e: 1, fade: .3, shrink: .5 }), mist = vParts(R, vN(o, 6), { ang: [-.6, .3], spd: [20, 40], life: [.3, .5], drag: 4, r: [2, 3], kind: 'dot', e: .45 });
  return (c) => { if (c.t < .08) vDisc(c, 0, -4, 0, 4, 1); vDraw(c, mist); vDraw(c, dr); }; });
vfxAdd('Golpes', 'dust', 'Poeira de golpe', ['Poeira'], .7, 9, (R, o) => { const pf = vParts(R, vN(o, 8), { spd: [15, 30], life: [.4, .7], drag: 4, r: [3, 4.5], grow: .8, kind: 'smoke', shade: [.5, .85] }), dt = vParts(R, vN(o, 8), { spd: [30, 55], life: [.2, .4], drag: 5, r: .9, kind: 'dot', e: 1 });
  return (c) => { if (c.t < .1) vDisc(c, 0, 0, 0, 5, 1); vDraw(c, pf); vDraw(c, dt); }; }, { smoke: 0 });

// --- Cortes
function vArc(c, slot, r, w, a0, span, e) { if (span > .02) vRing(c, slot, 0, 0, r, w, e, { a0, span, taper: true }); }
function vSwing(R, o, opt) { const dir = opt.dir || 1, a0 = opt.a0 ?? -2.3, sweep = opt.sweep ?? 2.6, r = opt.r ?? 18, w = opt.w ?? 4.5, sp = opt.sparks ? vParts(R, vN(o, opt.sparks), { spd: [25, 55], life: [.2, .4], drag: 4, r: .8, kind: 'streak', e: 1.1, slot: opt.sparkSlot || 0, t0: [.08, .2] }) : [];
  sp.forEach(p => { const a = a0 + sweep * R.r(.5, 1) * dir; p.x = Math.cos(a) * r; p.y = Math.sin(a) * r; p.vx = -Math.sin(a) * 40 * dir + R.r(-10, 10); p.vy = Math.cos(a) * 40 * dir + R.r(-10, 10); });
  return (c) => { const u = c.t / c.T, head = vEase.out4(clamp(u * 1.8, 0, 1)), tail = vEase.in(clamp((u - .15) * 1.4, 0, 1)), s = a0 + sweep * tail, span = sweep * (head - tail);
    vArc(c, 0, r, w * (1 - tail * .5), s, span, 1.25 - tail * .5); if (opt.inner) vArc(c, 0, r - w * .9, w * .4, s + span * .3, span * .7, .6); vDraw(c, sp); }; }
vfxAdd('Cortes', 'slash', 'Corte', ['Aço'], .45, 8, (R, o) => vSwing(R, o, {}));
vfxAdd('Cortes', 'heavy', 'Corte pesado', ['Fogo'], .65, 10, (R, o) => vSwing(R, o, { r: 20, w: 7, sweep: 3.1, inner: true, sparks: 10 }));
vfxAdd('Cortes', 'cross', 'Corte em X', ['Gelo'], .6, 10, (R, o) => (c) => { const u = c.t / c.T; for (let j = 0; j < 2; j++) { const s = clamp((u - j * .3) * 2.4, 0, 1), f = clamp((u - j * .3 - .35) * 2.2, 0, 1), dx = j ? -1 : 1, h = vEase.out4(s), tl = vEase.in(f); if (s <= 0 || tl >= 1) continue; const L = 22, x0 = -L * dx, y0 = -L, ax = x0 + 2 * L * dx * tl, ay = y0 + 2 * L * tl, bx = x0 + 2 * L * dx * h, by = y0 + 2 * L * h; vLine(c, 0, ax, ay, bx, by, .5, 2.4 * (1 - tl * .6), .7, 1.3); } });
vfxAdd('Cortes', 'claw', 'Garras', ['Sangue'], .5, 8, (R, o) => (c) => { const u = c.t / c.T, h = vEase.out4(clamp(u * 2, 0, 1)), tl = vEase.in(clamp((u - .25) * 1.6, 0, 1)); for (let j = -1; j <= 1; j++) { const pts = (v) => [-14 + j * 7 + v * 26, -18 + v * 36 + Math.sin(v * Math.PI) * 4 * j]; const [ax, ay] = pts(tl), [bx, by] = pts(h); if (h > tl) vLine(c, 0, ax, ay, bx, by, .4, 1.8 * (1 - tl * .5), .7, 1.3); } });
vfxAdd('Cortes', 'spin', 'Redemoinho', ['Aço'], .8, 12, (R, o) => (c) => { const a = c.t / c.T * VTAU; for (let j = 0; j < 2; j++) vArc(c, 0, 20 - j * 6, 4 - j, a + j * Math.PI, 3.2, 1.2 - j * .3); }, { loop: true });
vfxAdd('Cortes', 'thrust', 'Estocada', ['Elétrico'], .45, 8, (R, o) => { const sp = vParts(R, vN(o, 6), { ang: [-.6, .6], spd: [30, 60], life: [.15, .3], t0: [.08, .14], x: 22, drag: 5, r: .8, kind: 'streak', e: 1.1 });
  return (c) => { const u = c.t / c.T, h = vEase.out4(clamp(u * 2.4, 0, 1)), tl = vEase.in(clamp((u - .2) * 1.5, 0, 1)); vLine(c, 0, -24 + 48 * tl, 0, -24 + 48 * h, 0, .5, 2.4 * (1 - tl), .7, 1.3); if (u > .15 && u < .5) vSpark(c, 0, -24 + 48 * h, 0, 5, 1.2); vDraw(c, sp); }; });

// --- Fogo e fumaça (laços)
function vFlame(R, o, opt) { const w = opt.w || 7, h = opt.h || 1, y0 = opt.y ?? 14, ps = vParts(R, vN(o, opt.n || 34), { x: [-w, w], y: [y0, y0 + 2], ang: [vUP - .25, vUP + .25], spd: [28 * h, 44 * h], life: [.4, .8], t0: [0, opt.T], r: [2.8, 4.6], drag: .8, wob: 1.2, kind: 'dot', e: [1, 1.3] });
  ps.forEach(p => { p.vx -= p.x * 1.3; p.r *= 1 - Math.abs(p.x) / (w * 2.2); });
  const em = vParts(R, vN(o, opt.embers ?? 4), { x: [-w * .6, w * .6], y: y0 - 6, ang: [vUP - .4, vUP + .4], spd: [20, 34], life: [.5, .9], t0: [0, opt.T], r: .6, wob: 2, kind: 'dot', e: 1 });
  return (c) => { vLine(c, 0, -w * .8, y0 + 1, w * .8, y0 + 1, 2.4, 2.4, .5, .5); vDraw(c, ps, c.T); vDraw(c, em, c.T); }; }
vfxAdd('Fogo e fumaça', 'flame', 'Chama', ['Fogo'], 1, 10, (R, o) => vFlame(R, o, { T: 1 }), { loop: true });
vfxAdd('Fogo e fumaça', 'torch', 'Tocha', ['Fogo'], .8, 8, (R, o) => vFlame(R, o, { T: .8, w: 4, n: 20, h: .8, y: 8, embers: 3 }), { loop: true });
vfxAdd('Fogo e fumaça', 'blue', 'Chama azul', ['Gelo'], 1, 10, (R, o) => vFlame(R, o, { T: 1 }), { loop: true });
vfxAdd('Fogo e fumaça', 'wall', 'Parede de fogo', ['Fogo'], 1.2, 12, (R, o) => vFlame(R, o, { T: 1.2, w: 24, n: 80, h: .9, embers: 8 }), { loop: true });
vfxAdd('Fogo e fumaça', 'smoke', 'Fumaça subindo', ['Fumaça'], 2.2, 16, (R, o) => { const ps = vParts(R, vN(o, 12), { x: [-2, 2], y: 18, ang: [vUP - .2, vUP + .2], spd: [12, 18], life: [1.6, 2.2], t0: [0, 2.2], r: [2.5, 3.5], grow: 2.2, wob: 2.5, kind: 'smoke', shade: [.45, .8] }); return (c) => vDraw(c, ps, c.T); }, { loop: true, smoke: 0 });
vfxAdd('Fogo e fumaça', 'puff', 'Nuvem de fumaça', ['Fumaça'], .9, 11, (R, o) => { const ps = vParts(R, vN(o, 12), { spd: [14, 28], life: [.55, .9], drag: 4, r: [4, 6], grow: .9, kind: 'smoke', gy: -8, shade: [.45, .9] }); return (c) => vDraw(c, ps); }, { smoke: 0 });
function vDustSide(R, o, wide) { const ps = vParts(R, vN(o, wide ? 14 : 8), { ang: 0, spd: [wide ? 22 : 14, wide ? 48 : 30], life: [.45, .8], drag: 4, r: [3.2, 4.8], grow: 1.2, kind: 'smoke', y: [14, 16], gy: -12, shade: [.5, .85] }); ps.forEach((p, j) => { if (j % 2) p.vx *= -1; p.x = p.vx > 0 ? 2 : -2; }); return (c) => vDraw(c, ps); }
vfxAdd('Fogo e fumaça', 'jump', 'Poeira do pulo', ['Poeira'], .6, 8, (R, o) => vDustSide(R, o, false), { smoke: 0 });
vfxAdd('Fogo e fumaça', 'land', 'Poeira da queda', ['Poeira'], .75, 9, (R, o) => vDustSide(R, o, true), { smoke: 0 });

// --- Magia
vfxAdd('Magia', 'heal', 'Cura', ['Cura'], 1.2, 12, (R, o) => { const pl = vParts(R, vN(o, 5), { x: [-12, 12], y: [4, 14], ang: vUP, spd: [12, 20], life: [.6, .9], t0: [0, .4], kind: 'glyph', glyph: 'plus' }), sk = vParts(R, vN(o, 8), { x: [-14, 14], y: [-4, 14], ang: vUP, spd: [8, 16], life: [.4, .7], t0: [0, .7], r: [2, 3], kind: 'spark', e: 1.1 });
  return (c) => { const u = c.t / c.T; vRing(c, 0, 0, 14, 8 + u * 10, 1.2, 1 - u, { sy: .35 }); vDraw(c, sk); vDraw(c, pl); }; });
vfxAdd('Magia', 'portal', 'Portal', ['Arcano'], 1.2, 12, (R, o) => { const ps = vParts(R, vN(o, 14), { life: 1.2, t0: [0, 1.2], kind: 'none' }); return (c) => { const a = c.t / c.T * VTAU; vRing(c, 0, 0, 0, 14, 2.5, 1.1, { sy: 1.25 }); vRing(c, 0, 0, 0, 9, 1.3, .7, { sy: 1.25 });
  for (const p of ps) { const g = ((c.t - p.t0) % c.T + c.T) % c.T / c.T, r = 18 * (1 - g), an = p.ph + a + g * 4; vDisc(c, 0, Math.cos(an) * r, Math.sin(an) * r * 1.25, .9, 1.2 * g + .3); } vDisc(c, 0, 0, 0, 3 + Math.sin(a * 2), .5); }; }, { loop: true });
vfxAdd('Magia', 'buff', 'Fortalecer', ['Ouro'], 1.1, 12, (R, o) => { const ps = vParts(R, vN(o, 12), { x: [-14, 14], y: [6, 16], ang: vUP, spd: [25, 45], life: [.35, .6], t0: [0, .6], r: 1, kind: 'streak', tr: .12, e: 1.1 }); return (c) => { const u = c.t / c.T; vRing(c, 0, 0, 14, 4 + vEase.out(u) * 16, 1.4, 1.1 - u, { sy: .35 }); vDraw(c, ps); }; });
vfxAdd('Magia', 'levelup', 'Subir de nível', ['Ouro', 'Sagrado'], 1.5, 16, (R, o) => { const ps = vParts(R, vN(o, 10), { x: [-10, 10], y: 14, ang: vUP, spd: [30, 50], life: [.4, .7], t0: [.1, .8], r: 1, kind: 'streak', tr: .1, e: 1.1, slot: 1 }), sk = vParts(R, vN(o, 6), { x: [-14, 14], y: [-14, 10], spd: 2, life: [.3, .5], t0: [.2, 1.1], r: [2, 3], kind: 'spark', e: 1.2, slot: 1 });
  return (c) => { const u = c.t / c.T, b = Math.sin(Math.PI * clamp(u * 1.4, 0, 1)); for (let x = -6; x <= 6; x += 1.5) vLine(c, 1, x, 14, x, 14 - 40 * b, .8, .8, .9 * b * (1 - Math.abs(x) / 8), .3 * b); vRing(c, 0, 0, 14, 6 + u * 14, 1.5, 1 - u, { sy: .35 }); vDraw(c, ps); vDraw(c, sk); if (u > .2) vGlyph(c, 0, 'up', 0, 8 - vEase.out(clamp((u - .2) * 2, 0, 1)) * 18, u > .85 ? (1 - u) / .15 : 1, 1.4); }; });
vfxAdd('Magia', 'poison', 'Nuvem de veneno', ['Veneno'], 2, 14, (R, o) => { const sm = vParts(R, vN(o, 10), { x: [-10, 10], y: [4, 12], ang: vUP, spd: [3, 7], life: [1.4, 2], t0: [0, 2], r: [4, 6], grow: .8, wob: 2, kind: 'smoke', shade: [.5, .9] }), bb = vParts(R, vN(o, 6), { x: [-10, 10], y: [4, 12], ang: vUP, spd: [8, 14], life: [.6, 1], t0: [0, 2], r: [1.5, 2.5], kind: 'ring', e: 1.1, wob: 1.5 });
  return (c) => { vDraw(c, sm, c.T); vDraw(c, bb, c.T); }; }, { loop: true, smoke: 0 });
vfxAdd('Magia', 'curse', 'Maldição', ['Sombra', 'Neon'], 1.4, 14, (R, o) => { const ps = vParts(R, vN(o, 16), { life: [.8, 1.2], t0: [0, .5], kind: 'none' }); return (c) => { const u = c.t / c.T; for (const p of ps) { const a = c.t - p.t0; if (a < 0 || a > p.life) continue; const g = a / p.life, r = 22 * (1 - g), an = p.ph + g * 5; vSmoke(c, Math.cos(an) * r, Math.sin(an) * r * .8, 3.5, .8 * (1 - g * .5), .7); vDisc(c, 1, Math.cos(an + .3) * r * .9, Math.sin(an + .3) * r * .7, .8, 1.2 * g); } if (u > .55) vDisc(c, 1, 0, 0, 6 * Math.sin(Math.PI * (u - .55) / .45), 1.2); }; }, { smoke: 0 });
vfxAdd('Magia', 'ice', 'Gelo estilhaçado', ['Gelo'], .9, 11, (R, o) => { const sh = vParts(R, vN(o, 12), { spd: [35, 65], life: [.45, .75], gy: 90, drag: 1.5, r: [1, 1.6], kind: 'streak', tr: .07, e: 1.2, fade: .4 }), mist = vParts(R, vN(o, 6), { spd: [8, 16], life: [.5, .8], drag: 3, r: [3, 4], grow: 1, kind: 'smoke', shade: [.6, .95] });
  return (c) => { const u = c.t / c.T; if (c.t < .12) { vStar(c, 0, 6, 0, 12, 1.4, 0, 1.6); vDisc(c, 0, 0, 0, 6, 1.4); } vRing(c, 0, 0, 0, vEase.out(clamp(u * 2, 0, 1)) * 22, 1, (1 - u) * .8); vDraw(c, mist); vDraw(c, sh); }; }, { smoke: 0 });
vfxAdd('Magia', 'holy', 'Luz sagrada', ['Sagrado'], 1.4, 14, (R, o) => { const sk = vParts(R, vN(o, 10), { x: [-10, 10], y: [-24, 14], ang: vUP, spd: [4, 10], life: [.3, .6], t0: [.1, 1.1], r: [2, 3], kind: 'spark', e: 1.2 });
  return (c) => { const u = c.t / c.T, b = Math.sin(Math.PI * clamp(u * 1.2, 0, 1)), wd = 4 + 6 * b; for (let y = -32; y <= 14; y += 1) { const ww = wd * (.85 + vNoise(y * .2, c.t * 6, 3) * .3); vLine(c, 0, -ww, y, ww, y, .5, .5, .55 * b, .55 * b); } vLine(c, 0, 0, -32, 0, 14, wd * .3, wd * .3, 1.2 * b, 1.2 * b); vRing(c, 0, 0, 14, wd * 1.6, 1.5, b, { sy: .35 }); vDraw(c, sk); }; });
vfxAdd('Magia', 'teleport', 'Teletransporte', ['Arcano'], 1, 12, (R, o) => { const ps = vParts(R, vN(o, 14), { x: [-8, 8], y: [-12, 14], ang: vUP, spd: [20, 45], life: [.3, .6], t0: [0, .7], r: .9, kind: 'streak', tr: .08, e: 1.1 }); return (c) => { const u = c.t / c.T, w = 4.5 * (1 - vEase.in(u)); if (w > .3) { vLine(c, 0, 0, -26 * (1 - u * .3), 0, 14, w, w, .45, .6); vLine(c, 0, 0, -26 * (1 - u * .3), 0, 14, w * .3, w * .3, 1.2, 1.2); } vRing(c, 0, 0, 14, 10 * (1 - u) + 2, 1.2, 1 - u, { sy: .35 }); vDraw(c, ps); if (u > .85) vSpark(c, 0, 0, -4, 8 * (1 - u) / .15, 1.3); }; });
vfxAdd('Magia', 'circle', 'Círculo mágico', ['Arcano'], 1.6, 16, (R, o) => { const sk = vParts(R, vN(o, 8), { x: [-16, 16], y: [6, 18], ang: vUP, spd: [10, 20], life: [.5, .9], t0: [0, 1.6], r: .8, kind: 'dot', e: 1 }); return (c) => { const a = c.t / c.T * VTAU; vRing(c, 0, 0, 12, 20, 1.2, 1.1, { sy: .4 }); vRing(c, 0, 0, 12, 14, .9, .8, { sy: .4 }); for (let j = 0; j < 6; j++) { const an = a + j / 6 * VTAU; vDisc(c, 0, Math.cos(an) * 17, 12 + Math.sin(an) * 17 * .4, 1, 1.2); } for (let j = 0; j < 3; j++) { const an = -a + j / 3 * VTAU; vLine(c, 0, Math.cos(an) * 14, 12 + Math.sin(an) * 5.6, Math.cos(an + 2.1) * 14, 12 + Math.sin(an + 2.1) * 5.6, .4, .4, .6, .6); } vDraw(c, sk, c.T); }; }, { loop: true });
vfxAdd('Magia', 'aura', 'Aura', ['Gelo'], 1, 10, (R, o) => { const ps = vParts(R, vN(o, 26), { life: [.4, .7], t0: [0, 1], ang: vUP, spd: [18, 30], r: [1.6, 2.6], kind: 'dot', e: 1.1, wob: .8 }); ps.forEach(p => { const a = R.r(0, VTAU); p.x = Math.cos(a) * 13; p.y = 10 + Math.sin(a) * 4; }); return (c) => vDraw(c, ps, c.T); }, { loop: true });
vfxAdd('Magia', 'charge', 'Carregar', ['Elétrico'], 1.2, 14, (R, o) => { const ps = vParts(R, vN(o, 18), { life: [.3, .5], t0: [0, .85], kind: 'none' }); return (c) => { const u = c.t / c.T; for (const p of ps) { const a = c.t - p.t0; if (a < 0 || a > p.life) continue; const g = vEase.in(a / p.life), r = 26 * (1 - g), r2 = 26 * (1 - Math.max(0, g - .15)); vLine(c, 0, Math.cos(p.ph) * r2, Math.sin(p.ph) * r2, Math.cos(p.ph) * r, Math.sin(p.ph) * r, .4, .8, .5, 1.1); } vDisc(c, 0, 0, 0, 2 + u * 5, .8 + u * .5); if (u > .88) vRing(c, 0, 0, 0, (u - .88) / .12 * 20, 1.5, 1.2); }; });

// --- Raios
vfxAdd('Raios', 'strike', 'Raio', ['Elétrico'], .8, 10, (R, o) => (c) => { const u = c.t / c.T, fr = vRng(c.seed + (c.i >> 1) * 97); if (u < .45) { const e = u < .3 ? 1.3 : (1 - (u - .3) / .15) * 1.3; vBolt(c, 0, fr.r(-6, 6), -32, 0, 14, e, fr, .45, .5); } vRing(c, 0, 0, 14, vEase.out(clamp(u * 2, 0, 1)) * 20, 1.4, (1 - u) * 1.1, { sy: .35 }); vDisc(c, 0, 0, 14, 7 * (1 - u), 1.2 * (1 - u)); });
vfxAdd('Raios', 'ball', 'Bola elétrica', ['Elétrico'], .8, 8, (R, o) => { const nb = vN(o, 4); return (c) => { const fr = vRng(c.seed + c.i * 53); vDisc(c, 0, 0, 0, 6, 1.3); vRing(c, 0, 0, 0, 7.5, 1, .8); for (let j = 0; j < nb; j++) { const a = fr.r(0, VTAU); vBolt(c, 0, Math.cos(a) * 5, Math.sin(a) * 5, Math.cos(a) * fr.r(13, 20), Math.sin(a) * fr.r(13, 20), 1.1, fr, .5, 0, 3); } }; }, { loop: true });
vfxAdd('Raios', 'static', 'Faíscas estáticas', ['Elétrico'], 1, 10, (R, o) => { const nb = vN(o, 3); return (c) => { const fr = vRng(c.seed + c.i * 71); for (let j = 0; j < nb; j++) { const x = fr.r(-18, 18), y = fr.r(-18, 18), a = fr.r(0, VTAU), L = fr.r(6, 12); if (fr() < .7) vBolt(c, 0, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, 1.1, fr, .6, 0, 3); } }; }, { loop: true });

// --- Projéteis (laço, voando para a direita no lugar)
function vProj(R, o, opt) { const tr = vParts(R, vN(o, opt.n || 16), { x: [8, 10], y: [-2, 2], ang: [Math.PI - .25, Math.PI + .25], spd: [30, 50], life: [.25, .45], t0: [0, opt.T], r: [1.2, 2.2], kind: opt.kind || 'dot', e: [.9, 1.1], grow: 1, shade: .7, slot: opt.trailSlot || 0 });
  return (c) => { const w = Math.sin(c.t / c.T * VTAU * 2) * .6; vDraw(c, tr, c.T); opt.head(c, 10, w); }; }
vfxAdd('Projéteis', 'fireball', 'Bola de fogo', ['Fogo'], .6, 8, (R, o) => vProj(R, o, { T: .6, head: (c, x, w) => { vDisc(c, 0, x, w, 5.5, 1.1); vDisc(c, 0, x + 1, w, 3, 1.4); } }), { loop: true });
vfxAdd('Projéteis', 'orb', 'Orbe de energia', ['Elétrico'], .6, 8, (R, o) => vProj(R, o, { T: .6, n: 8, head: (c, x, w) => { vDisc(c, 0, x, w, 5, 1.2); const a = c.t / c.T * VTAU * 2; vDisc(c, 0, x + Math.cos(a) * 8, w + Math.sin(a) * 4, .9, 1.2); vDisc(c, 0, x - Math.cos(a) * 8, w - Math.sin(a) * 4, .9, 1.2); vRing(c, 0, x, w, 7, .8, .6); } }), { loop: true });
vfxAdd('Projéteis', 'frost', 'Raio de gelo', ['Gelo'], .6, 8, (R, o) => vProj(R, o, { T: .6, kind: 'streak', n: 10, head: (c, x, w) => { vLine(c, 0, x - 8, w, x + 6, w, 1.5, 2.6, .8, 1.3); vSpark(c, 0, x + 5, w, 4, 1.3); } }), { loop: true });
vfxAdd('Projéteis', 'acid', 'Ácido', ['Veneno'], .6, 8, (R, o) => vProj(R, o, { T: .6, n: 10, head: (c, x, w) => { vDisc(c, 0, x, w + 1, 4.5, 1.05); vDisc(c, 0, x + 1.5, w - 1, 1.6, 1.4); } }), { loop: true });
vfxAdd('Projéteis', 'shadow', 'Projétil sombrio', ['Sombra', 'Neon'], .6, 8, (R, o) => vProj(R, o, { T: .6, kind: 'smoke', n: 10, head: (c, x, w) => { vSmoke(c, x, w, 6, .9, .6); vDisc(c, 1, x + 1, w, 2.6, 1.3); } }), { loop: true, smoke: 0 });
vfxAdd('Projéteis', 'missile', 'Míssil mágico', ['Arcano'], .6, 8, (R, o) => vProj(R, o, { T: .6, n: 10, head: (c, x, w) => { vSpark(c, 0, x, w, 6 + Math.sin(c.t / c.T * VTAU * 2), 1.3); vDisc(c, 0, x, w, 2.5, 1.2); } }), { loop: true });

// --- Água e natureza
vfxAdd('Água e natureza', 'splash', 'Respingo', ['Água'], .9, 11, (R, o) => { const dr = vParts(R, vN(o, 14), { y: 12, ang: [vUP - .8, vUP + .8], spd: [30, 60], life: [.5, .8], gy: 140, r: [.9, 1.6], kind: 'dot', e: 1.1, fade: .3, shrink: .4 }); return (c) => { const u = c.t / c.T; vRing(c, 0, 0, 14, 4 + vEase.out(u) * 18, 1.5, 1.1 * (1 - u), { sy: .3 }); vDraw(c, dr); }; });
vfxAdd('Água e natureza', 'ripple', 'Ondulação', ['Água'], 1.4, 12, (R, o) => (c) => { for (let j = 0; j < 3; j++) { const g = (c.t / c.T + j / 3) % 1; vRing(c, 0, 0, 0, 3 + g * 24, 1.3, 1.1 * (1 - g), { sy: .45 }); } }, { loop: true });
vfxAdd('Água e natureza', 'bubbles', 'Bolhas', ['Água'], 1.8, 14, (R, o) => { const ps = vParts(R, vN(o, 9), { x: [-14, 14], y: [10, 18], ang: vUP, spd: [14, 22], life: [1, 1.6], t0: [0, 1.8], r: [1.5, 3], kind: 'ring', e: 1.1, wob: 1.5 }); return (c) => vDraw(c, ps, c.T); }, { loop: true });
vfxAdd('Água e natureza', 'leaves', 'Folhas', ['Folha'], 1.2, 12, (R, o) => { const ps = vParts(R, vN(o, 9), { spd: [25, 45], life: [.8, 1.2], drag: 3, gy: 20, wob: 3, kind: 'glyph', glyph: 'leaf' }); return (c) => { if (c.t < .1) vDisc(c, 0, 0, 0, 5, 1); vDraw(c, ps); }; });
vfxAdd('Água e natureza', 'rocks', 'Pedras quebrando', ['Terra', 'Poeira'], 1, 12, (R, o) => { const ch = vParts(R, vN(o, 8), { ang: [vUP - 1.3, vUP + 1.3], spd: [30, 55], life: [.6, .9], gy: 150, kind: 'glyph', glyph: 'rock' }), du = vParts(R, vN(o, 8), { spd: [10, 22], life: [.5, .8], drag: 3, r: [3, 4.5], grow: 1, kind: 'smoke', shade: [.5, .85] }); return (c) => { vDraw(c, du); vDraw(c, ch); }; }, { smoke: 1 });
vfxAdd('Água e natureza', 'wood', 'Lascas de madeira', ['Terra'], .8, 10, (R, o) => { const ch = vParts(R, vN(o, 10), { ang: [vUP - 1.5, vUP + 1.5], spd: [30, 60], life: [.45, .75], gy: 160, kind: 'glyph', glyph: 'chip' }); return (c) => vDraw(c, ch); });
vfxAdd('Água e natureza', 'snow', 'Neve', ['Gelo'], 1, 11, (R, o) => { const ps = vParts(R, vN(o, 16), { spd: [15, 40], life: [.6, 1], drag: 4, gy: 25, wob: 1.5, r: [.7, 1.2], kind: 'dot', e: 1.4, fade: .5 }), m = vParts(R, vN(o, 5), { spd: [6, 12], life: [.4, .7], drag: 3, r: [3, 4], grow: 1, kind: 'smoke', shade: .9 }); return (c) => { vDraw(c, m); vDraw(c, ps); }; }, { smoke: 0 });

// --- Coletáveis
vfxAdd('Coletáveis', 'coin', 'Moeda girando', ['Ouro'], .8, 8, (R, o) => (c) => { const a = c.t / c.T * VTAU, w = Math.abs(Math.cos(a)) * 7; vCoin(c, 0, 0, 0, Math.max(.6, w), 7.5, 1); if (Math.cos(a) > .9) vSpark(c, 0, 4, -5, 3, 1.3); }, { loop: true });
vfxAdd('Coletáveis', 'sparkle', 'Brilho', ['Ouro'], 1.2, 12, (R, o) => { const ps = vParts(R, vN(o, 6), { x: [-16, 16], y: [-16, 16], spd: 0, life: [.4, .6], t0: [0, 1.2], r: [3, 5], kind: 'spark', e: 1.3 }); return (c) => vDraw(c, ps, c.T); }, { loop: true });
vfxAdd('Coletáveis', 'shine', 'Item brilhando', ['Ouro'], 1, 10, (R, o) => (c) => { const u = c.t / c.T, on = u > .1 && u < .9 ? .9 : 0; vLine(c, 0, -20 + u * 28, 10, -8 + u * 28, -10, .8, .8, on, on); vSpark(c, 0, 8, -8, 5 * Math.sin(u * Math.PI), 1.3); }, { loop: true });
vfxAdd('Coletáveis', 'collect', 'Coletar', ['Cura'], .8, 10, (R, o) => { const sk = vParts(R, vN(o, 8), { spd: [25, 45], life: [.3, .5], drag: 4, r: [2, 3.5], kind: 'spark', e: 1.2 }); return (c) => { const u = c.t / c.T; vRing(c, 0, 0, 0, vEase.out(u) * 18, 1.6 * (1 - u) + .5, 1.2 * (1 - u)); if (u < .2) vDisc(c, 0, 0, 0, 6, 1.3); vDraw(c, sk); }; });

// --- Status (ícones)
vfxAdd('Status', 'love', 'Corações', ['Rosa'], 1.6, 12, (R, o) => { const ps = vParts(R, vN(o, 4), { x: [-10, 10], y: [4, 10], ang: vUP, spd: [14, 20], life: [1, 1.3], t0: [0, 1.6], wob: 2, kind: 'glyph', glyph: 'heart' }); return (c) => vDraw(c, ps, c.T); }, { loop: true });
vfxAdd('Status', 'statup', 'Atributo subindo', ['Cura'], 1, 10, (R, o) => { const ps = vParts(R, vN(o, 3), { x: [-10, 10], y: [6, 12], ang: vUP, spd: [18, 26], life: [.6, .9], t0: [0, 1], kind: 'glyph', glyph: 'up' }); return (c) => vDraw(c, ps, c.T); }, { loop: true });
vfxAdd('Status', 'statdown', 'Atributo caindo', ['Sangue'], 1, 10, (R, o) => { const ps = vParts(R, vN(o, 3), { x: [-10, 10], y: [-14, -8], ang: Math.PI / 2, spd: [18, 26], life: [.6, .9], t0: [0, 1], kind: 'glyph', glyph: 'down' }); return (c) => vDraw(c, ps, c.T); }, { loop: true });
vfxAdd('Status', 'sleep', 'Sono', ['Gelo'], 1.8, 12, (R, o) => (c) => { for (let j = 0; j < 3; j++) { const g = (c.t / c.T + j / 3) % 1; vGlyph(c, 0, 'z', -4 + g * 14 + Math.sin(g * 6) * 2, 8 - g * 24, g > .75 ? (1 - g) / .25 : 1, .6 + g * .8); } }, { loop: true });
vfxAdd('Status', 'stun', 'Atordoado', ['Ouro'], 1, 10, (R, o) => (c) => { const a = c.t / c.T * VTAU; vRing(c, 0, 0, -8, 13, .6, .45, { sy: .35 }); for (let j = 0; j < 3; j++) { const an = a + j / 3 * VTAU; vGlyph(c, 0, 'star', Math.cos(an) * 13, -8 + Math.sin(an) * 13 * .35, 1, Math.sin(an) > 0 ? 1 : .8); } }, { loop: true });
vfxAdd('Status', 'alert', 'Alerta', ['Fogo'], .8, 10, (R, o) => (c) => { const u = c.t / c.T, s = vEase.back(clamp(u * 3, 0, 1)); if (s > .05) vGlyph(c, 0, 'excl', 0, -2 - s * 6, 1, .4 + s * 1.1); if (u < .35) vStar(c, 0, 6, 8, 8 + u * 30, 1.1 * (1 - u / .35), -.3, .6); });
vfxAdd('Status', 'sweat', 'Suor', ['Água'], 1, 10, (R, o) => { const ps = vParts(R, vN(o, 3), { x: [-8, 8], y: -10, ang: [vUP - 1.2, vUP + 1.2], spd: [25, 35], life: [.5, .8], t0: [0, 1], gy: 90, kind: 'glyph', glyph: 'drop' }); return (c) => vDraw(c, ps, c.T); }, { loop: true });
vfxAdd('Status', 'doom', 'Marca da morte', ['Sombra', 'Neon'], 1.4, 12, (R, o) => { const sm = vParts(R, vN(o, 6), { x: [-6, 6], y: [-4, 4], ang: vUP, spd: [6, 10], life: [.8, 1.2], t0: [0, 1.4], r: [3, 4], grow: 1, kind: 'smoke', shade: .6 }); return (c) => { const a = c.t / c.T * VTAU; vDraw(c, sm, c.T); vGlyph(c, 1, 'skull', 0, -6 + Math.sin(a) * 2, 1, 1.5); }; }, { loop: true, smoke: 0 });

/* ---------- renderização ---------- */
/** o: size, frames, speed (1 = normal), scale, dens, glow (0..1), seed, ramps [nomes], hard, flipH, flipV, rot (0..3), pal ([[r,g,b]] ou null) */
function vfxRender(def, o) {
  const S = o.size, N = clamp(o.frames | 0, 1, 64), ramps = def.ramps.map((r, j) => VFX_RAMPS[(o.ramps && o.ramps[j]) || r] || VFX_RAMPS[r]), T = def.dur, k = S / 64 * (o.scale || 1);
  const rgbCache = new Map(), rgb = (h) => { let v = rgbCache.get(h); if (!v) { v = hex2rgb(h); rgbCache.set(h, v); } return v; };
  const draw = def.make(vRng(o.seed), { dens: o.dens ?? 1 }), out = [];
  for (let i = 0; i < N; i++) {
    const t = def.loop ? i / N * T : (i + .6) / N * T;
    const c = { S, k, T, t, i, ox: 0, oy: 0, seed: o.seed | 0, ramps, rgb, L: ramps.map(() => new Float32Array(S * S)), M: new Float32Array(S * S), Ms: new Float32Array(S * S), P: new Uint8ClampedArray(S * S * 4) };
    draw(c); out.push(vfxCompose(c, def, o));
  }
  return { frames: out, fps: Math.max(1, Math.round(N / T * (o.speed || 1))) };
}
function vfxCompose(c, def, o) {
  const S = c.S, n2 = S * S, d = new Uint8ClampedArray(n2 * 4), hard = !!o.hard, glow = o.glow ?? .6, TH = .14;
  // fumaça
  const sr = c.ramps[def.smoke ?? 0];
  for (let i = 0; i < n2; i++) { const m = c.M[i]; if (m < .06) continue; const sh = clamp(c.Ms[i] / m, 0, .999), col = c.rgb(sr[Math.round((.3 + sh * .7) * (sr.length - 1))]); let a = Math.min(1, m); a = a < .3 ? .35 : a < .55 ? .6 : a < .8 ? .85 : 1;
    if (hard) { if (a < 1 && a <= BAYER4[((i / S | 0) & 3) * 4 + (i % S & 3)] * 1.2) continue; a = 1; } const j = i * 4; d[j] = col[0]; d[j + 1] = col[1]; d[j + 2] = col[2]; d[j + 3] = a * 255; }
  // brilho (desfoque da luz, em degraus translúcidos)
  if (glow > 0) for (let s = 0; s < c.L.length; s++) {
    const L = c.L[s], rb = Math.max(1, Math.round(1.6 * c.k * (.5 + glow))), B = vBlur(L, S, rb), ramp = c.ramps[s], gc = c.rgb(ramp[Math.min(ramp.length - 1, Math.floor(ramp.length * .55))]);
    for (let i = 0; i < n2; i++) { if (L[i] >= TH) continue; let g = B[i] * glow * 1.5; if (g < .1) continue; let a = g < .3 ? .22 : g < .6 ? .4 : .6; if (hard) { if (a <= BAYER4[((i / S | 0) & 3) * 4 + (i % S & 3)] * 1.6) continue; a = 1; }
      const j = i * 4, oa = d[j + 3] / 255; if (oa >= a && !hard) continue; d[j] = gc[0]; d[j + 1] = gc[1]; d[j + 2] = gc[2]; d[j + 3] = Math.max(oa, a) * 255; }
  }
  // luz (opaca, degraus da rampa); onde dois slots disputam, ganha o mais forte
  for (let i = 0; i < n2; i++) { let best = -1, v = 0; for (let s = 0; s < c.L.length; s++) if (c.L[s][i] > v) { v = c.L[s][i]; best = s; } if (v < TH) continue;
    const ramp = c.ramps[best], col = c.rgb(ramp[Math.min(ramp.length - 1, Math.floor((v - TH) / (1 - TH) * ramp.length))]), j = i * 4; d[j] = col[0]; d[j + 1] = col[1]; d[j + 2] = col[2]; d[j + 3] = 255; }
  // sólidos por cima
  for (let i = 0; i < n2; i++) { const j = i * 4, a = c.P[j + 3]; if (!a) continue; let aa = a / 255; if (hard) { if (aa < 1 && aa <= BAYER4[((i / S | 0) & 3) * 4 + (i % S & 3)]) continue; aa = 1; } const da = d[j + 3] / 255, oa = aa + da * (1 - aa);
    for (let q = 0; q < 3; q++) d[j + q] = (c.P[j + q] * aa + d[j + q] * da * (1 - aa)) / oa; d[j + 3] = oa * 255; }
  let img = { width: S, height: S, data: d };
  if (o.pal && o.pal.length) vQuant(img, o.pal);
  if (o.flipH || o.flipV || o.rot) img = vXform(img, o.flipH, o.flipV, o.rot | 0);
  return img;
}
function vBlur(L, S, r) { const tmp = new Float32Array(S * S), out = new Float32Array(S * S), w = 2 * r + 1, cl = (v) => Math.min(1.2, v);
  for (let y = 0; y < S; y++) { let acc = 0; for (let x = -r; x <= r; x++) acc += cl(L[y * S + clamp(x, 0, S - 1)]) * (x >= 0 && x < S); for (let x = 0; x < S; x++) { tmp[y * S + x] = acc / w; const a = x - r, b = x + r + 1; if (a >= 0) acc -= cl(L[y * S + a]); if (b < S) acc += cl(L[y * S + b]); } }
  for (let x = 0; x < S; x++) { let acc = 0; for (let y = 0; y <= r && y < S; y++) acc += tmp[y * S + x]; for (let y = 0; y < S; y++) { out[y * S + x] = acc / w; const a = y - r, b = y + r + 1; if (a >= 0) acc -= tmp[a * S + x]; if (b < S) acc += tmp[b * S + x]; } }
  return out; }
function vQuant(img, pal) { const d = img.data, memo = new Map(); for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]; let p = memo.get(key);
  if (!p) { let bd = 1e9; for (const q of pal) { const dr = d[i] - q[0], dg = d[i + 1] - q[1], db = d[i + 2] - q[2], dd = dr * dr * 2 + dg * dg * 4 + db * db * 3; if (dd < bd) { bd = dd; p = q; } } memo.set(key, p); } d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; } }
function vXform(img, fh, fv, rot) { const S = img.width, out = new Uint8ClampedArray(img.data.length);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { let sx = fh ? S - 1 - x : x, sy = fv ? S - 1 - y : y; for (let r = 0; r < rot; r++) { const t = sx; sx = sy; sy = S - 1 - t; } out.set(img.data.subarray((sy * S + sx) * 4, (sy * S + sx) * 4 + 4), (y * S + x) * 4); }
  return { width: S, height: S, data: out }; }
