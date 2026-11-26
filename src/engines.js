/* Snapforge engines — ports JS dos projetos open source da Sprite Fusion (MIT, © Hugo Duprez):
 *   - Pixel Snapper:   https://github.com/Hugo-Dz/spritefusion-pixel-snapper  (src/lib.rs)
 *   - Sprite Normals:  https://github.com/Hugo-Dz/spritefusion-sprite-normals (src/*.rs)
 * Tradução fiel do código Rust. Trabalha com {width, height, data: Uint8ClampedArray RGBA}.
 */
(function (root) {
  'use strict';

  /* ============================ PIXEL SNAPPER ============================ */
  const SNAP_DEFAULTS = {
    k_colors: 16, k_seed: 42, max_kmeans_iterations: 15,
    peak_threshold_multiplier: 0.2, peak_distance_filter: 4,
    walker_search_window_ratio: 0.35, walker_min_search_window: 2.0,
    walker_strength_threshold: 0.5, min_cuts_per_axis: 4,
    fallback_target_segments: 64, max_step_ratio: 1.8,
    pixel_size_override: null, palette: null,
  };

  // PRNG determinístico (o original usa ChaCha8 com seed 42; aqui mulberry32 com a mesma seed)
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function parsePaletteHex(value) {
    if (!value || !String(value).trim()) throw new Error('A paleta precisa ter ao menos uma cor');
    const seen = new Set(), pal = [];
    for (const part of String(value).split(',')) {
      const hex = part.trim().replace(/^#/, '');
      if (!/^[0-9a-fA-F]{6}$/.test(hex)) throw new Error("Cor inválida na paleta: '" + part.trim() + "'");
      const key = hex.toLowerCase();
      if (!seen.has(key)) { seen.add(key); pal.push([parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]); }
    }
    if (pal.length > 256) throw new Error('A paleta pode ter no máximo 256 cores');
    return pal;
  }

  function quantizeImage(img, cfg) {
    const { width: w, height: h, data } = img;
    const n = w * h;
    const idx = [];
    for (let i = 0; i < n; i++) if (data[i * 4 + 3] !== 0) idx.push(i);
    const N = idx.length;
    if (N === 0) return { width: w, height: h, data: new Uint8ClampedArray(data) };
    const px = new Float32Array(N * 3);
    for (let j = 0; j < N; j++) { const o = idx[j] * 4; px[j * 3] = data[o]; px[j * 3 + 1] = data[o + 1]; px[j * 3 + 2] = data[o + 2]; }
    const rand = rng(cfg.k_seed);
    const k = Math.min(cfg.k_colors, N);
    const cent = [];
    const pick = (j) => [px[j * 3], px[j * 3 + 1], px[j * 3 + 2]];
    cent.push(pick(Math.floor(rand() * N)));
    const dist = new Float64Array(N).fill(Number.MAX_VALUE);
    for (let c = 1; c < k; c++) {
      const L = cent[cent.length - 1];
      let sum = 0;
      for (let j = 0; j < N; j++) {
        const dr = px[j * 3] - L[0], dg = px[j * 3 + 1] - L[1], db = px[j * 3 + 2] - L[2];
        const d = dr * dr + dg * dg + db * db;
        if (d < dist[j]) dist[j] = d;
        sum += dist[j];
      }
      if (sum <= 0) { cent.push(pick(Math.floor(rand() * N))); continue; }
      let r = rand() * sum, chosen = N - 1;
      for (let j = 0; j < N; j++) { r -= dist[j]; if (r < 0) { chosen = j; break; } }
      cent.push(pick(chosen));
    }
    let prev = cent.map((c) => c.slice());
    for (let it = 0; it < cfg.max_kmeans_iterations; it++) {
      const sums = Array.from({ length: k }, () => [0, 0, 0]), counts = new Array(k).fill(0);
      for (let j = 0; j < N; j++) {
        const r = px[j * 3], g = px[j * 3 + 1], b = px[j * 3 + 2];
        let best = 0, md = Infinity;
        for (let c = 0; c < k; c++) { const dr = r - cent[c][0], dg = g - cent[c][1], db = b - cent[c][2]; const d = dr * dr + dg * dg + db * db; if (d < md) { md = d; best = c; } }
        sums[best][0] += r; sums[best][1] += g; sums[best][2] += b; counts[best]++;
      }
      for (let c = 0; c < k; c++) if (counts[c] > 0) cent[c] = [sums[c][0] / counts[c], sums[c][1] / counts[c], sums[c][2] / counts[c]];
      if (it > 0) {
        let mm = 0;
        for (let c = 0; c < k; c++) { const dr = cent[c][0] - prev[c][0], dg = cent[c][1] - prev[c][1], db = cent[c][2] - prev[c][2]; mm = Math.max(mm, dr * dr + dg * dg + db * db); }
        if (mm < 0.01) break;
      }
      prev = cent.map((c) => c.slice());
    }
    const out = new Uint8ClampedArray(data);
    const cache = new Map();
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      if (data[o + 3] === 0) continue;
      const key = (data[o] << 16) | (data[o + 1] << 8) | data[o + 2];
      let c = cache.get(key);
      if (!c) {
        let md = Infinity; c = [data[o], data[o + 1], data[o + 2]];
        for (const ce of cent) { const dr = data[o] - ce[0], dg = data[o + 1] - ce[1], db = data[o + 2] - ce[2]; const d = dr * dr + dg * dg + db * db; if (d < md) { md = d; c = [Math.round(ce[0]), Math.round(ce[1]), Math.round(ce[2])]; } }
        cache.set(key, c);
      }
      out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2];
    }
    return { width: w, height: h, data: out };
  }

  function applyPalette(img, pal) {
    const out = new Uint8ClampedArray(img.data), cache = new Map();
    for (let o = 0; o < out.length; o += 4) {
      if (out[o + 3] === 0) continue;
      const key = (out[o] << 16) | (out[o + 1] << 8) | out[o + 2];
      let c = cache.get(key);
      if (!c) { c = nearestColor(out[o], out[o + 1], out[o + 2], pal); cache.set(key, c); }
      out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2];
    }
    return { width: img.width, height: img.height, data: out };
  }
  function nearestColor(r, g, b, pal) {
    let best = pal[0], bd = Infinity;
    for (const c of pal) { const dr = r - c[0], dg = g - c[1], db = b - c[2]; const d = dr * dr + dg * dg + db * db; if (d < bd) { bd = d; best = c; } }
    return best;
  }

  function computeProfiles(img) {
    const { width: w, height: h, data } = img;
    if (w < 3 || h < 3) throw new Error('Imagem pequena demais (mínimo 3x3)');
    const gray = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) { const o = i * 4; gray[i] = data[o + 3] === 0 ? 0 : 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]; }
    const col = new Float64Array(w), row = new Float64Array(h);
    for (let y = 0; y < h; y++) for (let x = 1; x < w - 1; x++) col[x] += Math.abs(gray[y * w + x + 1] - gray[y * w + x - 1]);
    for (let x = 0; x < w; x++) for (let y = 1; y < h - 1; y++) row[y] += Math.abs(gray[(y + 1) * w + x] - gray[(y - 1) * w + x]);
    return [col, row];
  }

  function estimateStepSize(p, cfg) {
    if (!p.length) return null;
    let mx = -Infinity; for (const v of p) if (v > mx) mx = v;
    if (mx === 0) return null;
    const thr = mx * cfg.peak_threshold_multiplier;
    const peaks = [];
    for (let i = 1; i < p.length - 1; i++) if (p[i] > thr && p[i] > p[i - 1] && p[i] > p[i + 1]) peaks.push(i);
    if (peaks.length < 2) return null;
    const clean = [peaks[0]];
    for (let j = 1; j < peaks.length; j++) if (peaks[j] - clean[clean.length - 1] > cfg.peak_distance_filter - 1) clean.push(peaks[j]);
    if (clean.length < 2) return null;
    const diffs = [];
    for (let j = 1; j < clean.length; j++) diffs.push(clean[j] - clean[j - 1]);
    diffs.sort((a, b) => a - b);
    return diffs[Math.floor(diffs.length / 2)];
  }

  function resolveStepSizes(sx, sy, w, h, cfg) {
    if (cfg.pixel_size_override != null) return [cfg.pixel_size_override, cfg.pixel_size_override];
    if (sx != null && sy != null) {
      const ratio = sx > sy ? sx / sy : sy / sx;
      if (ratio > cfg.max_step_ratio) { const s = Math.min(sx, sy); return [s, s]; }
      const a = (sx + sy) / 2; return [a, a];
    }
    if (sx != null) return [sx, sx];
    if (sy != null) return [sy, sy];
    const f = Math.max(Math.min(w, h) / cfg.fallback_target_segments, 1); return [f, f];
  }

  const mean = (p) => { let s = 0; for (const v of p) s += v; return p.length ? s / p.length : 0; };

  function walk(p, step, limit, cfg) {
    if (!p.length) throw new Error('Perfil vazio');
    const cuts = [0];
    let cur = 0;
    const win = Math.max(step * cfg.walker_search_window_ratio, cfg.walker_min_search_window);
    const mv = mean(p);
    while (cur < limit) {
      const target = cur + step;
      if (target >= limit) { cuts.push(limit); break; }
      const start = Math.max(Math.max(0, Math.trunc(target - win)), Math.trunc(cur + 1));
      const end = Math.min(Math.trunc(target + win), limit);
      if (end <= start) { cur = target; continue; }
      let mxv = -1, mi = start;
      for (let i = start; i < end && i < p.length; i++) if (p[i] > mxv) { mxv = p[i]; mi = i; }
      if (mxv > mv * cfg.walker_strength_threshold) { cuts.push(mi); cur = mi; }
      else { cuts.push(Math.trunc(target)); cur = target; }
    }
    return cuts;
  }

  function sanitizeCuts(cuts, limit) {
    if (limit === 0) return [0];
    let hz = false, hl = false;
    cuts = cuts.map((v) => { if (v === 0) hz = true; if (v >= limit) v = limit; if (v === limit) hl = true; return v; });
    if (!hz) cuts.push(0);
    if (!hl) cuts.push(limit);
    cuts.sort((a, b) => a - b);
    return cuts.filter((v, i) => i === 0 || v !== cuts[i - 1]);
  }

  function snapUniformCuts(p, limit, targetStep, cfg, minReq) {
    if (limit === 0) return [0];
    if (limit === 1) return [0, 1];
    let desired = isFinite(targetStep) && targetStep > 0 ? Math.round(limit / targetStep) : 0;
    desired = Math.min(Math.max(desired, Math.max(minReq - 1, 0), 1), limit);
    const cw = limit / desired;
    const win = Math.max(cw * cfg.walker_search_window_ratio, cfg.walker_min_search_window);
    const mv = mean(p);
    const cuts = [0];
    for (let idx = 1; idx < desired; idx++) {
      const target = cw * idx;
      const prev = cuts[cuts.length - 1];
      if (prev + 1 >= limit) break;
      let start = Math.max(Math.floor(target - win), prev + 1, 0);
      let end = Math.min(Math.ceil(target + win), limit - 1);
      if (end < start) { start = prev + 1; end = start; }
      const last = Math.max(p.length - 1, 0);
      let bi = Math.min(start, last), bv = -1;
      for (let i = start; i <= Math.min(end, last); i++) { const v = p[i] || 0; if (v > bv) { bv = v; bi = i; } }
      if (bv < mv * cfg.walker_strength_threshold) {
        let f = Math.round(target);
        if (f <= prev) f = prev + 1;
        if (f >= limit) f = Math.max(limit - 1, prev + 1);
        bi = f;
      }
      cuts.push(bi);
    }
    if (cuts[cuts.length - 1] !== limit) cuts.push(limit);
    return sanitizeCuts(cuts, limit);
  }

  function stabilizeCuts(p, cuts, limit, sib, sibLimit, cfg) {
    if (limit === 0) return [0];
    cuts = sanitizeCuts(cuts, limit);
    const minReq = Math.min(Math.max(cfg.min_cuts_per_axis, 2), limit + 1);
    const axisCells = Math.max(cuts.length - 1, 0);
    const sibCells = Math.max(sib.length - 1, 0);
    const sibHas = sibLimit > 0 && sibCells >= Math.max(minReq - 1, 0) && sibCells > 0;
    let skewed = false;
    if (sibHas && axisCells > 0) {
      const r = (limit / axisCells) / (sibLimit / sibCells);
      skewed = r > cfg.max_step_ratio || r < 1 / cfg.max_step_ratio;
    }
    if (cuts.length >= minReq && !skewed) return cuts;
    let ts = sibHas ? sibLimit / sibCells : cfg.fallback_target_segments > 1 ? limit / cfg.fallback_target_segments : axisCells > 0 ? limit / axisCells : limit;
    if (!isFinite(ts) || ts <= 0) ts = 1;
    return snapUniformCuts(p, limit, ts, cfg, minReq);
  }

  function stabilizeBoth(px, py, rc, rr, w, h, cfg) {
    const c1 = stabilizeCuts(px, rc.slice(), w, rr, h, cfg);
    const r1 = stabilizeCuts(py, rr.slice(), h, rc, w, cfg);
    const cs = w / Math.max(c1.length - 1, 1), rs = h / Math.max(r1.length - 1, 1);
    const ratio = cs > rs ? cs / rs : rs / cs;
    if (ratio > cfg.max_step_ratio) {
      const t = Math.min(cs, rs);
      return [cs > t * 1.2 ? snapUniformCuts(px, w, t, cfg, cfg.min_cuts_per_axis) : c1,
              rs > t * 1.2 ? snapUniformCuts(py, h, t, cfg, cfg.min_cuts_per_axis) : r1];
    }
    return [c1, r1];
  }

  function resample(img, cols, rows) {
    if (cols.length < 2 || rows.length < 2) throw new Error('Grade insuficiente para reamostrar');
    const ow = cols.length - 1, oh = rows.length - 1, out = new Uint8ClampedArray(ow * oh * 4);
    const { width: w, height: h, data } = img;
    for (let yi = 0; yi < oh; yi++) for (let xi = 0; xi < ow; xi++) {
      const ys = rows[yi], ye = rows[yi + 1], xs = cols[xi], xe = cols[xi + 1];
      if (xe <= xs || ye <= ys) continue;
      const counts = new Map();
      for (let y = ys; y < ye && y < h; y++) for (let x = xs; x < xe && x < w; x++) {
        const o = (y * w + x) * 4;
        const key = data[o] * 16777216 + (data[o + 1] << 16) + (data[o + 2] << 8) + data[o + 3];
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      let bk = 0, bc = -1;
      for (const [key, c] of counts) if (c > bc || (c === bc && key < bk)) { bc = c; bk = key; }
      const o = (yi * ow + xi) * 4;
      out[o] = Math.floor(bk / 16777216) & 255; out[o + 1] = (bk >>> 16) & 255; out[o + 2] = (bk >>> 8) & 255; out[o + 3] = bk & 255;
    }
    return { width: ow, height: oh, data: out };
  }

  function snapPixels(img, opts) {
    const cfg = Object.assign({}, SNAP_DEFAULTS, opts || {});
    if (typeof cfg.palette === 'string') cfg.palette = parsePaletteHex(cfg.palette);
    const { width: w, height: h } = img;
    if (!w || !h) throw new Error('Imagem vazia');
    if (w > 10000 || h > 10000) throw new Error('Imagem grande demais (máx. 10000x10000)');
    if (!(cfg.k_colors > 0)) throw new Error('Número de cores precisa ser maior que 0');
    if (cfg.pixel_size_override != null) {
      const px = cfg.pixel_size_override;
      if (!isFinite(px) || px < 1 || px > Math.min(w, h) / 2) throw new Error('Tamanho de pixel fora do intervalo [1, ' + Math.floor(Math.min(w, h) / 2) + ']');
    }
    const an = quantizeImage(img, cfg);
    const [pX, pY] = computeProfiles(an);
    const [sx, sy] = resolveStepSizes(estimateStepSize(pX, cfg), estimateStepSize(pY, cfg), w, h, cfg);
    const [cols, rows] = stabilizeBoth(pX, pY, walk(pX, sx, w, cfg), walk(pY, sy, h, cfg), w, h, cfg);
    let out = resample(an, cols, rows);
    if (cfg.palette) out = applyPalette(out, cfg.palette);
    out.pixelSize = sx; out.cols = cols; out.rows = rows;
    return out;
  }

  /* ============================ SPRITE NORMALS ============================ */
  const NORMAL_DEFAULTS = {
    alpha_threshold: 0.03, shape_radius: 4.0, shape_strength: 1.15, shape_softness: 1.15,
    detail_strength: 6.0, detail_scale: 0.6, normal_strength: 1.5, directx: false,
    invert_x: false, invert_y: false, frame_size: null,
  };
  const f = Math.fround;
  const LINEAR = new Float32Array(256).map((_, v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  function lightness(r, g, b) {
    r = LINEAR[r]; g = LINEAR[g]; b = LINEAR[b];
    const l = Math.cbrt(0.41222146 * r + 0.53633255 * g + 0.051445995 * b);
    const m = Math.cbrt(0.2119035 * r + 0.6806995 * g + 0.10739696 * b);
    const s = Math.cbrt(0.08830246 * r + 0.28171885 * g + 0.6299787 * b);
    return f(0.21045426 * l + 0.7936178 * m - 0.004072047 * s);
  }
  const padding = (s) => Math.ceil(3 * Math.max(s.shape_softness, s.detail_scale * 2)) + 3;

  function gaussian(field, w, h, sigma) {
    if (sigma < 0.05) return Float32Array.from(field);
    const rad = Math.ceil(sigma * 3);
    const k = []; let tot = 0;
    for (let i = -rad; i <= rad; i++) { const v = Math.exp(-0.5 * (i / sigma) ** 2); k.push(v); tot += v; }
    for (let i = 0; i < k.length; i++) k[i] /= tot;
    const hz = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) { const r = y * w; for (let x = 0; x < w; x++) { let s = 0; for (let t = -rad; t <= rad; t++) { const sx = x + t; if (sx >= 0 && sx < w) s += field[r + sx] * k[t + rad]; } hz[r + x] = s; } }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let t = -rad; t <= rad; t++) { const sy = y + t; if (sy >= 0 && sy < h) s += hz[sy * w + x] * k[t + rad]; } out[y * w + x] = s; }
    return out;
  }
  function maskedGaussian(input, weight, w, h, sigma) {
    const wt = new Float32Array(input.length);
    for (let i = 0; i < wt.length; i++) wt[i] = input[i] * weight[i];
    const num = gaussian(wt, w, h, sigma), den = gaussian(weight, w, h, sigma);
    for (let i = 0; i < num.length; i++) num[i] /= Math.max(den[i], 1e-8);
    return num;
  }
  function squaredLine(src, n, dst) {
    const sites = [], starts = [];
    for (let q = 0; q < n; q++) {
      const hgt = src[q]; if (!isFinite(hgt)) continue;
      let inter = -Infinity;
      while (sites.length) {
        const p = sites[sites.length - 1];
        inter = (hgt + q * q - src[p] - p * p) / (2 * (q - p));
        if (inter > starts[starts.length - 1]) break;
        sites.pop(); starts.pop();
      }
      if (!sites.length) inter = -Infinity;
      sites.push(q); starts.push(inter);
    }
    if (!sites.length) { for (let q = 0; q < n; q++) dst[q] = Infinity; return; }
    let a = 0;
    for (let q = 0; q < n; q++) { while (a + 1 < starts.length && starts[a + 1] < q) a++; const d = q - sites[a]; dst[q] = d * d + src[sites[a]]; }
  }
  function edt(mask, w, h) {
    const res = new Float32Array(w * h), src = new Float64Array(Math.max(w, h)), dst = new Float64Array(Math.max(w, h));
    for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) src[x] = mask[y * w + x] ? Infinity : 0; squaredLine(src, w, dst); for (let x = 0; x < w; x++) res[y * w + x] = dst[x]; }
    for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) src[y] = res[y * w + x]; squaredLine(src, h, dst); for (let y = 0; y < h; y++) res[y * w + x] = Math.sqrt(dst[y]); }
    return res;
  }
  function components(mask, w, h) {
    const vis = new Uint8Array(mask.length), out = [];
    for (let s = 0; s < mask.length; s++) {
      if (!mask[s] || vis[s]) continue;
      const part = { pixels: [s], minX: s % w, minY: (s / w) | 0, maxX: s % w, maxY: (s / w) | 0 };
      vis[s] = 1;
      for (let c = 0; c < part.pixels.length; c++) {
        const i = part.pixels[c], x = i % w, y = (i / w) | 0;
        if (x < part.minX) part.minX = x; if (x > part.maxX) part.maxX = x; if (y < part.minY) part.minY = y; if (y > part.maxY) part.maxY = y;
        for (let ny = Math.max(y - 1, 0); ny <= Math.min(y + 1, h - 1); ny++) for (let nx = Math.max(x - 1, 0); nx <= Math.min(x + 1, w - 1); nx++) {
          const nb = ny * w + nx; if (mask[nb] && !vis[nb]) { vis[nb] = 1; part.pixels.push(nb); }
        }
      }
      out.push(part);
    }
    return out;
  }
  function slopesToNormal(dx, dy, s) {
    let x = -dx * s.normal_strength, y = dy * s.normal_strength;
    if (s.directx) y = -y; if (s.invert_x) x = -x; if (s.invert_y) y = -y;
    const L = Math.sqrt(x * x + (y * y + 1));
    return [x / L, y / L, 1 / L];
  }
  function relief(island, s) {
    const pad = padding(s), iw = island.width, ih = island.height, W = iw + 2 * pad, H = ih + 2 * pad;
    const opa = new Float32Array(W * H), lig = new Float32Array(W * H), mask = new Uint8Array(W * H);
    let lo = 1, hi = 0;
    for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
      const o = (y * iw + x) * 4, i = (y + pad) * W + x + pad, a = island.data[o + 3] / 255;
      if (a <= s.alpha_threshold) continue;
      mask[i] = 1; opa[i] = a;
      const v = lightness(island.data[o], island.data[o + 1], island.data[o + 2]);
      lig[i] = v; lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    const mid = f((lo + hi) * 0.5);
    for (let i = 0; i < lig.length; i++) if (mask[i]) lig[i] -= mid;
    const shape = edt(mask, W, H), reach = s.shape_radius;
    for (let i = 0; i < shape.length; i++) { const inset = Math.max(shape[i] - 0.5, 0); shape[i] = s.shape_strength * reach * Math.log1p(inset / reach); }
    const comb = gaussian(shape, W, H, s.shape_softness);
    const fine = maskedGaussian(lig, opa, W, H, s.detail_scale), broad = maskedGaussian(lig, opa, W, H, s.detail_scale * 2);
    for (let i = 0; i < comb.length; i++) comb[i] += s.detail_strength * (0.7 * fine[i] + 0.3 * broad[i]);
    const out = new Uint8ClampedArray(iw * ih * 4);
    for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
      const o = (y * iw + x) * 4, i = (y + pad) * W + x + pad;
      out[o + 3] = island.data[o + 3];
      if (!mask[i]) { out[o] = 128; out[o + 1] = 128; out[o + 2] = 255; continue; }
      const d = comb, up = i - W, dn = i + W;
      const dx = (d[up + 1] + 2 * d[i + 1] + d[dn + 1] - d[up - 1] - 2 * d[i - 1] - d[dn - 1]) * 0.125;
      const dy = (d[dn - 1] + 2 * d[dn] + d[dn + 1] - d[up - 1] - 2 * d[up] - d[up + 1]) * 0.125;
      const n = slopesToNormal(dx, dy, s);
      out[o] = Math.round((n[0] * 0.5 + 0.5) * 255); out[o + 1] = Math.round((n[1] * 0.5 + 0.5) * 255); out[o + 2] = Math.round((n[2] * 0.5 + 0.5) * 255);
    }
    return out;
  }
  function validateNormal(s) {
    for (const [name, v, mn, mx] of [['alpha_threshold', s.alpha_threshold, 0, 0.99], ['shape_radius', s.shape_radius, 0.5, 512], ['shape_strength', s.shape_strength, 0, 8], ['shape_softness', s.shape_softness, 0, 8], ['detail_strength', s.detail_strength, 0, 8], ['detail_scale', s.detail_scale, 0.6, 8], ['normal_strength', s.normal_strength, 0, 8]])
      if (!isFinite(v) || v < mn || v > mx) throw new Error(name + ' precisa estar entre ' + mn + ' e ' + mx);
  }
  function generateNormal(img, opts) {
    const s = Object.assign({}, NORMAL_DEFAULTS, opts || {});
    validateNormal(s);
    const { width: w, height: h, data } = img, pad = padding(s);
    if (!w || !h || (w + 2 * pad) * (h + 2 * pad) > 4194304) throw new Error('Imagem vazia ou acima do limite de 4.194.304 pixels');
    const [fw, fh] = s.frame_size || [w, h];
    if (!(fw > 0 && fh > 0) || w % fw || h % fh) throw new Error('As dimensões da imagem precisam ser múltiplos exatos do tamanho do quadro');
    const out = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) { out[i * 4] = 128; out[i * 4 + 1] = 128; out[i * 4 + 2] = 255; out[i * 4 + 3] = data[i * 4 + 3]; }
    for (let fy = 0; fy < h; fy += fh) for (let fx = 0; fx < w; fx += fw) {
      const mask = new Uint8Array(fw * fh);
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) mask[y * fw + x] = data[((fy + y) * w + fx + x) * 4 + 3] / 255 > s.alpha_threshold ? 1 : 0;
      for (const part of components(mask, fw, fh)) {
        const iw = part.maxX - part.minX + 1, ih = part.maxY - part.minY + 1, isl = new Uint8ClampedArray(iw * ih * 4);
        for (const idx of part.pixels) { const sx = idx % fw, sy = (idx / fw) | 0, so = ((fy + sy) * w + fx + sx) * 4, d = ((sy - part.minY) * iw + sx - part.minX) * 4; isl[d] = data[so]; isl[d + 1] = data[so + 1]; isl[d + 2] = data[so + 2]; isl[d + 3] = data[so + 3]; }
        const g = relief({ width: iw, height: ih, data: isl }, s);
        for (const idx of part.pixels) { const sx = idx % fw, sy = (idx / fw) | 0, d = ((fy + sy) * w + fx + sx) * 4, so = ((sy - part.minY) * iw + sx - part.minX) * 4; out[d] = g[so]; out[d + 1] = g[so + 1]; out[d + 2] = g[so + 2]; out[d + 3] = g[so + 3]; }
      }
    }
    return { width: w, height: h, data: out };
  }

  const api = { snapPixels, parsePaletteHex, applyPalette, nearestColor, generateNormal, SNAP_DEFAULTS, NORMAL_DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PXEngines = api;
})(typeof self !== 'undefined' ? self : this);
